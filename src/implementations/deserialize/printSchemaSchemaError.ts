import { printEmbeddedSchemaDeserializationError } from "./printEmbeddedSchemaDeserializationError"
import { SchemaError } from "../../interfaces/deserialize/Errors"
import { printPreTokenizerError, printStructureError, printTreeParserError } from ".."

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printSchemaSchemaError($$: SchemaError): string {
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
            return printEmbeddedSchemaDeserializationError($$$)
        }
        case "schema schema cannot be embedded": {
            return "schema schema cannot be embedded"
        }
        case "unknown schema schema": {
            //const $$$ = $$[1]
            return `unknown schema schema`
        }
        default:
            return assertUnreachable($$[0])
    }
}
