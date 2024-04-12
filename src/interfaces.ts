export interface OpenApiSpec {
  paths: Record<string, Record<string, Operation>>
  components: {
    schemas: Record<string, Schema>
  }
}

export interface Operation {
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
  responses?: Record<string, unknown>
}

export interface PathOperation {
  path: string
  method: string
  operation: Operation
}

export interface PathsByTag {
  [tag: string]: PathOperation[]
}

export interface SchemaProperty {
  type: string
  nullable?: boolean
}

export interface Schema {
  properties: Record<string, SchemaProperty>
}

export interface Schemas {
  [schemaName: string]: Schema
}

export interface SchemaContent {
  schema: {
    $ref: string
  }
}

export interface ApiResponse {
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
