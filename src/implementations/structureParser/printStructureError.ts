import { StructureErrorType } from "./functionTypes"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printStructureError($$: StructureErrorType): string {
    switch ($$[0]) {
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
            const $$$ = $$[1]
            return `unexpected data after end: ${$$$.data}`
        }
        default:
            return assertUnreachable($$[0])
    }
}
