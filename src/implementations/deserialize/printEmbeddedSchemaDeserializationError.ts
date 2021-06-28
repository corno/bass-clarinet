import * as astncore from "astn-core"
import { SchemaDeserializationError } from "../../interfaces/deserialize"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

/**
 * a Document needs a schema to be validated. Besides the basic schema structure we want to be able to report additional
 * validation errors.
 * All built-in schemas create a combination of these 2
 */

export function printEmbeddedSchemaDeserializationError(error: SchemaDeserializationError): string {
    switch (error[0]) {
        case "expect": {
            const $$$ = error[1]
            return astncore.printExpectError($$$)
        }
        case "validation": {
            const $$$ = error[1]

            return $$$.message
        }
        case "stacked": {
            const $$$ = error[1]

            return astncore.printStackedDataError($$$)
        }
        default:
            return assertUnreachable(error[0])
    }
}