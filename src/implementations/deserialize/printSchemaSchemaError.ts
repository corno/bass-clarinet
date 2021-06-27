import { printInternalSchemaError } from "./printInternalSchemaError"
import { printInternalSchemaDeserializationError } from "./printInternalSchemaDeserializationError"
import { SchemaSchemaError } from "../../interfaces/deserialize/SchemaSchemaError"
import { printPreTokenizerError, printStructureError, printTreeParserError } from ".."

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printSchemaSchemaError($$: SchemaSchemaError): string {
    switch ($$[0]) {
        case "missing schema schema definition": {
            //const $$$ = $$[1]
            return `missing schema schema definition`
        }
        case "tokenizer": {
            const $$$ = $$[1]
            return printPreTokenizerError($$$)
        }
        case "structure": {
            const $$$ = $$[1]
            return printStructureError($$$)
        }
        case "tree": {
            const $$$ = $$[1]
            return printTreeParserError($$$)
        }
        case "schema processing": {
            const $$$ = $$[1]
            return printInternalSchemaDeserializationError($$$)
        }
        case "internal schema": {
            const $$$ = $$[1]
            return printInternalSchemaError($$$)
        }
        case "unknown schema schema": {
            //const $$$ = $$[1]
            return `unknown schema schema`
        }
        default:
            return assertUnreachable($$[0])
    }
}
