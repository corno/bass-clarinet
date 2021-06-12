import { TreeParserError } from "./functions"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printTreeParserError(error: TreeParserError): string {

    switch (error.type[0]) {
        case "expected option": {
            return `expected option`
        }
        case "expected key": {
            return `expected key`
        }
        case "missing property value": {
            return `missing property value`
        }
        case "not in an array": {
            return `not in an array`
        }
        case "not in an object": {
            return `not in an object`
        }
        case "invalid dictionary close": {
            return `expected '}'`
        }
        case "invalid verbose type close": {
            return `expected ')'`
        }
        case "invalid list close": {
            return `expected ']'`
        }
        case "invalid shorthand type close": {
            return `expected '>'`
        }
        case "not in an object": {
            return `not in an object`
        }
        case "not in an object": {
            return `not in an object`
        }
        case "unexpected '!'": {
            return `unexpected '!'`
        }
        case "unexpected end of text": {
            const $ = error.type[1]
            return `unexpected end of text, still in ${$["still in"][0]}`
        }
        case "unknown punctuation": {
            const $ = error.type[1]
            return `unknown punctuation: ${$.found}`
        }
        default:
            return assertUnreachable(error.type[0])
    }
}
