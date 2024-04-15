import fs from 'fs'
import { execSync } from 'child_process'
import chalk from 'chalk'
import path from 'path'
import {
  ANGULAR_SERVICE_TEMPLATE,
  HANDLE_ERROR_TEMPLATE,
  METHOD_TEMPLATE,
  SERVICE_TEMPLATE,
} from './templateCode'
import {
  ApiResponse,
  OpenApiSpec,
  Operation,
  PathOperation,
  PathsByTag,
  SchemaContent,
  Schemas,
} from './interfaces'
import { HttpMethod } from './types'

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
  if (usePrettierGlobal) formatFile(`./services/${fileName}`)
  console.log(chalk.green(`Interfaces written to ${fileName}.`))

  return schemaNames
}

function generateServiceClass(className: string, methods: string) {
  const angularService = SERVICE_TEMPLATE.replace(
    '{{className}}',
    className,
  ).replace('{{methods}}', methods)
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
  }
  return `\`${apiUrl}${fullPath}\``
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

    const successCode = successCodes.length > 0 ? successCodes[0] : '200'

    const methodString = METHOD_TEMPLATE.replace('{{methodName}}', methodName)
      .replace(/{{params}}/g, params)
      .replace(/{{httpMethod}}/g, method)
      .replace(/{{responseType}}/g, responseType)
      .replace(/{{url}}/g, url)
      .replace(/{{bodyParam}}/g, bodyParam)
      .replace(/{{successCode}}/g, successCode)

    methods += methodString
  })
  return methods
}

function getSuccessCodes(operation: ApiResponse): string[] {
  return Object.keys(operation.responses).filter(
    (code) =>
      operation.responses[code].description === 'Success' ||
      operation.responses[code].description === 'Created',
  )
}

function getResponseType(operation: ApiResponse): string {
  let responseType = 'unknown'
  for (const code in operation.responses) {
    const response =
      operation.responses[code]?.content?.['application/json']?.schema

    if (response?.type && 'type' in response) {
      responseType = response.type
      break
    }
    if (response?.$ref && '$ref' in response) {
      responseType = response.$ref.split('/').pop() || 'unknown'
      break
    }
  }
  if (responseType === 'array') responseType = `Array<${operation.tags[0]}>`
  return responseType
}

function writeServiceToFile(serviceName: string, serviceContent: string) {
  const fileName = `${serviceName}.ts`
  const filePath = path.join(servicesDir, fileName)
  fs.writeFileSync(filePath, serviceContent, 'utf8')

  if (usePrettierGlobal) formatFile(`./services/${fileName}`)

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
  const serviceClass = generateServiceClass(className, methods)

  const finalService = ANGULAR_SERVICE_TEMPLATE.replace(
    '{{interfaces}}',
    interfaces.join(', '),
  ).replace('{{serviceClass}}', serviceClass)
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

function mapOpenApiTypeToTypeScript(type: string) {
  const typeMappings = {
    integer: 'number',
    number: 'number',
    string: 'string',
    boolean: 'boolean',
    array: '[]',
  }
  return typeMappings[type] || 'unknown'
}

function isValidHttpMethod(method: string): method is HttpMethod {
  return ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(
    method,
  )
}

function generateMiddleWare() {
  const code = HANDLE_ERROR_TEMPLATE
  const filePath = path.join(servicesDir, 'handleError.ts')

  fs.writeFileSync(filePath, code)
  if (usePrettierGlobal) formatFile('./services/handleError.ts')
  console.log(chalk.green('handleError.ts file created successfully.'))
}

export async function setUpAPIservice(
  openApiSpecPath: string,
  usePrettier: boolean,
) {
  const openApiSpecContents = fs.readFileSync(openApiSpecPath, 'utf8')
  const openApiSpec = JSON.parse(openApiSpecContents)
  fs.mkdirSync('services', { recursive: true })
  //side effect, that is used for cleaning up files
  usePrettierGlobal = usePrettier
  generateAngularServices(openApiSpec)
  generateMiddleWare()
}

function formatFile(fileName: string) {
  execSync(`npx prettier ${fileName} --write`, { stdio: 'inherit' })
  console.log(chalk.green(`${fileName} has been formatted with Prettier.`))
}

export let usePrettierGlobal = false
