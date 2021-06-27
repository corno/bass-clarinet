
import { SchemaSchemaError } from "./SchemaSchemaError"
import { DeserializationDiagnostic } from "./DeserializationDiagnostic"
import * as astncore from "astn-core"
import { Range } from "../../generic"

export type LoadDocumentDiagnosticType =
| ["schema retrieval", {
    issue:
    | ["unknown retrieval error", { "description": string }]
    | ["validating schema file against internal schema"]
    | ["found both external and internal schema. ignoring internal schema"]
    | ["error in external schema", SchemaSchemaError]
    | ["no valid schema"]
    | ["missing schema"]
}]
| ["validation", {
    range: Range
    message: string
}]
| ["structure", {
    message: "missing (valid) schema"
}]
| ["deserialization", {
    data: DeserializationDiagnostic
    range: Range
}]


export type LoadDocumentDiagnostic = {
type: LoadDocumentDiagnosticType
severity: astncore.DiagnosticSeverity
}