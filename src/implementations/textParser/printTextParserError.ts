import { printTreeParserError } from "../treeParser"
import { TextParserError } from "./functions"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printTextParserError(error: TextParserError): string {
    switch (error.type[0]) {
        case "body": {
            const $$ = error.type[1]
            return printTreeParserError($$)
        }
        case "structure": {
            const $$ = error.type[1]
            switch ($$.type[0]) {
                case "expected rootvalue": {
                    return `expected rootvalue`
                }
                case "expected the schema": {
                    return `expected the schema`
                }
                case "expected the schema start (!) or root value": {
                    return `expected the schema start (!) or root value`
                }
                case "unexpected data after end": {
                    const $$$ = $$.type[1]
                    return `unexpected data after end: ${$$$.data}`
                }
                default:
                    return assertUnreachable($$.type[0])
            }
        }
        default:
            return assertUnreachable(error.type[0])
    }
}
