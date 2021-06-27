import * as astncore from "astn-core"
import { EmbeddedSchemaError } from "../../interfaces/deserialize"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printInternalSchemaError(error: EmbeddedSchemaError): string {
    switch (error[0]) {
        case "stacked": {
            const $$$ = error[1]
            return astncore.printStackedDataError($$$)
        }
        case "unexpected schema format": {
            const $$$ = error[1]
            switch ($$$.found[0]) {
                case "array": {
                    return "unexpected array as schema"
                }
                case "multiline string": {
                    return "unexpected multiline string as schema"
                }
                case "simple value": {
                    return "unexpected simple value as schema"
                }
                case "tagged union": {
                    return "unexpected tagged union as schema"
                }
                case "object": {
                    return "unexpected object as schema"
                }
                default:
                    return assertUnreachable($$$.found[0])
            }
        }
        default:
            return assertUnreachable(error[0])
    }
}