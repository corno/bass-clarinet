/* eslint
    "max-classes-per-file": off,
*/
import * as astncore from "astn-core"
import { printEmbeddedSchemaDeserializationError } from "./printEmbeddedSchemaDeserializationError"
import { DeserializationDiagnostic } from "../../interfaces/deserialize/DeserializationDiagnostic"
import { printPreTokenizerError, printStructureError, printTreeParserError } from ".."

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printDeserializationDiagnostic($: DeserializationDiagnostic): string {
    switch ($.type[0]) {
        case "stacked": {
            const $$ = $.type[1]
            return $$[0]
        }
        case "deserialize": {
            const $$ = $.type[1]
            return astncore.printDeserializeError($$)
        }
        case "tokenizer": {
            const $$ = $.type[1]
            return printPreTokenizerError($$)
        }
        case "structure": {
            const $$ = $.type[1]
            return printStructureError($$)
        }
        case "tree": {
            const $$ = $.type[1]
            return printTreeParserError($$)
        }
        case "embedded schema error": {
            const $$ = $.type[1]
            return printEmbeddedSchemaDeserializationError($$)
        }
        case "ignoring invalid embedded schema": {
            return $.type[0]
        }
        case "ignoring invalid schema reference": {
            return $.type[0]
        }
        case "schema reference resolving": {
            const $$$ = $.type[1]
            switch ($$$[0]) {
                case "errors in referenced schema": {
                    return `errors in referenced schema`
                }
                case "loading": {
                    const $$$$ = $$$[1]
                    return $$$$.message
                }
                default:
                    return assertUnreachable($$$[0])
            }
        }
        default:
            return assertUnreachable($.type[0])
    }
}
