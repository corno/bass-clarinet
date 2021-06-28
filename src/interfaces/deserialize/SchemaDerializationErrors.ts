import * as astncore from "astn-core"

export type SchemaDeserializationError =
| ["validation", {
    "message": string
}]
| ["expect", astncore.ExpectError]
| ["stacked", astncore.StackedDataErrorType]