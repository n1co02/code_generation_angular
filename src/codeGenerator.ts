import fs from 'fs'
import { execSync } from 'child_process'
import chalk from 'chalk'
import path from 'path'

interface OpenApiSpec {
  paths: Record<string, Record<string, Operation>>
  components: {
    schemas: Record<string, Schema>
  }
}

interface Operation {
  tags: string[]
  operationId?: string
  requestBody?: {
    content: {
      [mediaType: string]: {
        schema: {
          $ref: string
        }
      }
    }
  }
  responses?: Record<string, unknown> // Define a more specific type for responses
}

interface PathOperation {
  path: string
  method: string
  operation: Operation
}

interface PathsByTag {
  [tag: string]: PathOperation[]
}

interface SchemaProperty {
  type: string
  nullable?: boolean
}

interface Schema {
  properties: Record<string, SchemaProperty>
}

interface Schemas {
  [schemaName: string]: Schema
}

interface SchemaContent {
  schema: {
    $ref: string
  }
}

type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'options'
  | 'head'
interface ApiResponse {
  tags: string[]
  responses: {
    [statusCode: string]: {
      description: string
      content?: {
        [mediaType: string]: {
          schema: {
            type: string
            $ref?: string
            items?: {
              $ref: string
            }
          }
        }
      }
    }
  }
}

const servicesDir = path.join('./services')

function generateAngularServices(spec: OpenApiSpec) {
  const pathsByTag: PathsByTag = {}
  Object.keys(spec.paths).forEach((path) => {
    Object.keys(spec.paths[path]).forEach((method) => {
      const operation = spec.paths[path][method]
      const tags = operation.tags
      tags.forEach((tag) => {
        pathsByTag[tag] = pathsByTag[tag] || []
        pathsByTag[tag].push({ path, method, operation })
      })
    })
  })

  Object.keys(pathsByTag).forEach((tag) => {
    return generateServiceForTag(tag, pathsByTag[tag], spec.components.schemas)
  })
}

function generateInterfacesFromSchemas(schemas: Schemas): string[] {
  let interfaces = ''
  const schemaNames: string[] = []

  Object.keys(schemas).forEach((schemaName) => {
    const note = '/*This file was generated automatically.*/\n\n'
    schemaNames.push(schemaName)
    const schema = schemas[schemaName]
    if (schema) {
      const properties = schema.properties
      let interfaceString = `export interface ${schemaName} {\n`
      Object.keys(properties).forEach((prop) => {
        const property = properties[prop]
        const type = mapOpenApiTypeToTypeScript(property.type)
        interfaceString += `  ${prop}: ${type}${property.nullable ? ' | null' : ''};\n`
      })
      interfaceString += '}\n\n'
      interfaces += note + interfaceString
    }
  })

  const fileName = `interfaces.ts`
  const filePath = path.join(servicesDir, 'interfaces.ts')

  fs.writeFileSync(filePath, interfaces)
  if (usePrettierGlobal === true) formatFile(`./services/${fileName}`)
  console.log(chalk.green(`Interfaces written to ${fileName}.`))

  return schemaNames
}

function generateServiceClass(className: string, methods: string) {
  let angularService = `@Injectable({
    providedIn: 'root'
  })
  export class ${className} {
    constructor(private http: HttpClient) { }\n`

  angularService += methods
  angularService += '}'
  return angularService
}

function constructUrl(
  baseApiUrl: string,
  fullPath: string,
  paramName?: string,
): string {
  const apiUrl = `${baseApiUrl}`
  const pattern = /\/{([^}]+)}$/
  const match = fullPath.match(pattern)

  if (match && paramName) {
    const replacedPath = fullPath.replace(pattern, `/\${${paramName}}`)
    return `\`${apiUrl}${replacedPath}\``
  } else {
    return `\`${apiUrl}${fullPath}\``
  }
}

function constructParams(
  operation: Operation,
  fullPath: string,
): { params: string; bodyParam: string } {
  let params = '()'
  let bodyParam = ''
  let requestBodyType = ''

  if (operation.requestBody) {
    const contentKey = Object.keys(operation.requestBody.content)[0]
    const ref = (operation.requestBody.content[contentKey] as SchemaContent)
      .schema.$ref
    const schemaName = ref.split('/').pop()
    requestBodyType =
      schemaName === 'String' ? 'string' : (
        getResponseType(operation as ApiResponse)
      )
    params = `(body: ${requestBodyType})`
    bodyParam = ', body'
  }

  const pattern = /\/{([^}]+)}$/
  const match = fullPath.match(pattern)
  if (match) {
    const paramName = match[1]
    params = `(${paramName}: string)`
  }

  return { params, bodyParam }
}

function generateServiceMethods(paths: PathOperation[]): string {
  let methods = ''
  paths.forEach(({ path, method, operation }) => {
    if (!isValidHttpMethod(method)) {
      console.error(`Invalid HTTP method: ${method}`)
      return
    }
    const methodName = getMethodName(path, method, operation.operationId)
    const fullPath = path.replace('/api', '')
    const apiUrl = `\${ENVIRONMENT_BASE_API_URL}`

    const { params, bodyParam } = constructParams(operation, fullPath)
    const url = constructUrl(
      apiUrl,
      fullPath,
      params.includes(': string') ?
        params.match(/\(([^:]+): string\)/)[1]
      : undefined,
    )

    const responseType = getResponseType(operation as ApiResponse)
    const successCodes = getSuccessCodes(operation as ApiResponse)

    methods += ` 
    public ${methodName}${params}: Observable<${responseType}> {
      return this.http.${method}<${responseType}>(${url}${bodyParam}, { observe: 'response' }).pipe(
        map((response: { status: number; body: ${responseType} | null }) => {
          if (response.status === ${Number(successCodes[0])} && response.body !== null) {
            return response.body; 
          } else {
            throw new Error('Unexpected status code'); 
          }
        }),
        catchError(handleError) 
      );
    }\n`
  })
  return methods
}

function getSuccessCodes(operation: ApiResponse): string[] {
  const successCodes: string[] = []
  for (const code in operation.responses) {
    if (
      operation.responses[code].description === 'Success' ||
      operation.responses[code].description === 'Created'
    ) {
      successCodes.push(code)
    }
  }
  return successCodes
}
function getResponseType(operation: ApiResponse): string {
  let responseType = 'Unknown'
  for (const code in operation.responses) {
    const response =
      operation.responses[code]?.content?.['application/json']?.schema

    if (response) {
      if ('type' in response && response.type) {
        responseType = response.type
        break
      } else if ('$ref' in response && response.$ref) {
        responseType = response.$ref.split('/').pop() || 'Unknown'
        break
      }
    }
  }
  if (responseType === 'array') responseType = `Array<${operation.tags[0]}>`
  return responseType
}

function writeServiceToFile(serviceName: string, serviceContent: string) {
  const fileName = `${serviceName}.ts`
  const filePath = path.join(servicesDir, fileName)
  fs.writeFileSync(filePath, serviceContent, 'utf8')

  if (usePrettierGlobal === true) formatFile(`./services/${fileName}`)

  console.log(chalk.green(`${fileName} has been generated.`))
}

function generateServiceForTag(
  tag: string,
  paths: PathOperation[],
  schemas: Schemas,
) {
  const serviceName = `${tag}.service`
  const classNameRefactor = serviceName
    .split('.')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
  const className = classNameRefactor //serviceName.replace(/\./g, '')

  const interfaces = generateInterfacesFromSchemas(schemas)
  const methods = generateServiceMethods(paths)
  const angularServiceBoilerplate = `/*This file was generated automatically.
 ************************Your Imports may be different.*************************/
  import { Injectable } from '@angular/core';
  import { HttpClient } from '@angular/common/http';
  import { Observable } from 'rxjs';
  import { ENVIRONMENT_BASE_API_URL } from '../environments';/*Don't forget to change the path and add a env variable with a connection string file.*/
  import { catchError, map } from 'rxjs/operators';
  import { handleError } from './ChangeFilePath'/*Don't forget to change the path of the handleError file.*/;
  import { ${interfaces.join(', ')} } from './interfaces/ChangeFilePath';/*Don't forget to change the path of the interfaces file.*/
\n\n`
  const serviceClass = generateServiceClass(className, methods)
  const finalService = angularServiceBoilerplate + serviceClass
  writeServiceToFile(serviceName, finalService)
}

function getMethodName(
  path: string,
  method: HttpMethod,
  operationId: string | undefined,
) {
  if (operationId) return operationId
  const parts = path.split('/')
  const lastPart = parts.pop()
  if (!lastPart) return `${method}NoName`
  const name = lastPart.replace(/\{|\}/g, '')
  return `${method}${name.charAt(0).toUpperCase() + name.slice(1)}`
}

function mapOpenApiTypeToTypeScript(type: string | number) {
  const typeMappings = {
    integer: 'number',
    number: 'number',
    string: 'string',
    boolean: 'boolean',
    array: '[]',
  }
  return typeMappings[type] || 'any'
}

function isValidHttpMethod(method: string): method is HttpMethod {
  return ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(
    method,
  )
}

function generateMiddleWare() {
  const code = `/*This file was generated automatically.*/
  import { HttpErrorResponse } from '@angular/common/http';
  import { throwError } from 'rxjs';

  export function handleError(error: HttpErrorResponse) {
      let errorMessage = 'An unknown error has occurred.';
      if (error.error instanceof ErrorEvent) {
          // Client-side or network error occurred.
          errorMessage = \`An error occurred: \${error.error.message}\`;
      } else {
          // The backend returned an unsuccessful response code.
          errorMessage = \`Server returned code \${error.status}, error message is: \${error.message}\`;
      }
      console.error(errorMessage);
      // Return an observable with a user-facing error message.
      return throwError(() => new Error(errorMessage));
  }
  `
  const filePath = path.join(servicesDir, 'handleError.ts')

  fs.writeFileSync(filePath, code)
  if (usePrettierGlobal === true) formatFile('./services/handleError.ts')
  console.log(chalk.green('handleError.ts file created successfully.'))
}

export async function getFilePath(
  openApiSpecPath: string,
  usePrettier: boolean,
) {
  const openApiSpecContents = fs.readFileSync(openApiSpecPath, 'utf8')
  const openApiSpec = JSON.parse(openApiSpecContents)
  fs.mkdirSync('services', { recursive: true })
  usePrettierGlobal = usePrettier
  generateAngularServices(openApiSpec)
  generateMiddleWare()
}

function formatFile(fileName: string) {
  execSync(`npx prettier ${fileName} --write`, { stdio: 'inherit' })
  console.log(chalk.green(`${fileName} has been formatted with Prettier.`))
}

export let usePrettierGlobal = false
