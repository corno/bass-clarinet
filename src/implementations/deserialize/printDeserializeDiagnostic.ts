/* eslint
    "max-classes-per-file": off,
*/
import * as astncore from "astn-core"
import { printEmbeddedSchemaDeserializationError } from "./printEmbeddedSchemaDeserializationError"
import { DeserializeError, ExternalSchemaResolvingError } from "../../interfaces/deserialize/Errors"
import { printPreTokenizerError, printStructureError, printTreeParserError } from ".."

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printExternalSchemaResolvingError(error: ExternalSchemaResolvingError): string {

    switch (error[0]) {
        case "errors in external schema": {
            return `errors in external schema`
        }
        case "loading": {
            const $$$$ = error[1]
            return $$$$.message
        }
        default:
            return assertUnreachable(error[0])
    }
}

export function printDeserializationDiagnostic($: DeserializeError): string {
    switch ($[0]) {
        case "stacked": {
            const $$ = $[1]
            return $$[0]
        }
        case "deserialize": {
            const $$ = $[1]
            return astncore.printDeserializeError($$)
        }
        case "tokenizer": {
            const $$ = $[1]
            return printPreTokenizerError($$)
        }
        case "structure": {
            const $$ = $[1]
            return printStructureError($$)
        }
        case "tree": {
            const $$ = $[1]
            return printTreeParserError($$)
        }
        case "embedded schema error": {
            const $$ = $[1]
            return printEmbeddedSchemaDeserializationError($$)
        }
        case "found both internal and context schema. ignoring internal schema": {
            return `found both internal and context schema. ignoring internal schema`
        }
        case "invalid embedded schema": {
            return $[0]
        }
        case "no schema": {
            return "no schema found"
        }
        case "no valid schema": {
            return "no valid schema found"
        }
        case "invalid schema reference": {
            return $[0]
        }
        case "schema reference resolving": {
            const $$$ = $[1]
            return printExternalSchemaResolvingError($$$)
        }
        default:
            return assertUnreachable($[0])
    }
}
