
import { SchemaError } from "./SchemaSchemaError"
import { DeserializationDiagnostic } from "./DeserializationDiagnostic"
import * as astncore from "astn-core"
import { Range } from "../../generic"

export type LoadDocumentDiagnosticType =
| ["schema retrieval", {
    issue:
    | ["unknown retrieval error", { "description": string }]
    | ["validating schema file against internal schema"]
    | ["found both internal and context schema. ignoring internal schema"]
    | ["error in referenced schema", SchemaError]
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