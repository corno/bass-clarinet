import * as astncore from "astn-core"

export type EmbeddedSchemaError =
    | ["unexpected schema format", {
        found:
        | ["multiline string"]
        | ["array"]
        | ["object"]
        | ["simple value"]
        | ["tagged union"]
    }]
    | ["stacked", astncore.StackedDataErrorType]

export type ReferencedSchemaResolvingError =
    | ["schema id cannot be an empty string"]
    | ["errors in schema"]
    | ["loading", {
        message: string
    }]

export type InternalSchemaDeserializationError =
| ["validation", {
    "message": string
}]
| ["expect", astncore.ExpectError]
| ["schema reference resolving", ReferencedSchemaResolvingError]
| ["internal schema", EmbeddedSchemaError]