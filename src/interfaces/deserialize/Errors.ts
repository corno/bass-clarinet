import { StructureErrorType, TokenError, TreeParserError } from "../../implementations"

export type SchemaError =
    | ["schema schema cannot be embedded"]
    | ["unknown schema schema", {
        name: string
    }]
    | ["missing schema schema definition"]
    | ["tokenizer", TokenError]
    | ["structure", StructureErrorType]
    | ["tree", TreeParserError]
    | ["schema processing", SchemaDeserializationError]


export type ExternalSchemaResolvingError =
    | ["errors in external schema"]
    | ["loading", {
        message: string
    }]

export type ContextSchemaError =
    | ["validating schema file against internal schema"]
    | ["external schema resolving", ExternalSchemaResolvingError]


import * as astncore from "astn-core"

export type SchemaDeserializationError =
    | ["validation", {
        "message": string
    }]
    | ["expect", astncore.ExpectError]
    | ["stacked", astncore.StackedDataErrorType]


export type DeserializeError =
| ["no valid schema"]
| ["no schema"]
| ["found both internal and context schema. ignoring internal schema"]
| ["invalid embedded schema"]
| ["invalid schema reference"]
| ["deserialize", astncore.DeserializeError]
| ["stacked", astncore.StackedDataErrorType]
| ["tokenizer", TokenError]
| ["structure", StructureErrorType]
| ["tree", TreeParserError]
| ["embedded schema error", SchemaDeserializationError]
| ["schema reference resolving", ExternalSchemaResolvingError]
