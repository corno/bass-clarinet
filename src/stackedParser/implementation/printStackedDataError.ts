import { StackedDataError } from "../functions"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printStackedDataError(error: StackedDataError): string {
    switch (error[0]) {
        case "unmatched dictionary close": {
            return error[0]
        }
        case "unmatched verbose type close": {
            return error[0]
        }
        case "unmatched list close": {
            return error[0]
        }
        case "unmatched shorthand type close": {
            return error[0]
        }
        case "missing array close": {
            return error[0]
        }
        case "missing object close": {
            return error[0]
        }
        case "missing property data": {
            return error[0]
        }
        case "missing tagged union option and value": {
            return error[0]
        }
        case "missing tagged union value": {
            return error[0]
        }
        case "unexpected end of array": {
            return error[0]
        }
        case "unexpected end of document": {
            const $ = error[1]
            return `unexpected end of document, still in ${$["still in"][0]}`
        }
        case "unexpected end of object": {
            return error[0]
        }
        case "unexpected key": {
            return error[0]
        }
        default:
            return assertUnreachable(error[0])
    }
}