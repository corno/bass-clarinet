import {
    ExpectErrorValueType,
    ExpectErrorValue,
} from "../../interfaces/IExpectContext"
import {
    ExpectError,
} from "./functions"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function printExpectErrorValueType(vt: ExpectErrorValueType): string {
    switch (vt) {
        case "array": {
            return `an array ([] or <>)`
        }
        case "shorthand type": {
            return `a shorhand type (<>)`
        }
        case "boolean": {
            return `a boolean (true/false)`
        }
        case "dictionary": {
            return `a dictionary ( {} )`
        }
        case "list": {
            return `a list ( [] )`
        }
        case "nothing": {
            return `nothing`
        }
        case "null": {
            return `'null'`
        }
        case "number": {
            return `a number`
        }
        case "object": {
            return `an object ( {} or () )`
        }
        case "string": {
            return `a string (quoted, apostrophed, multiline or non wrapped (including a number, a keyword, a boolean)`
        }
        case "quoted string": {
            return `a string with quotes`
        }
        case "tagged union": {
            return `a tagged union ( | "statename" data )`
        }
        case "type": {
            return `a type ( () )`
        }
        case "type or shorthand type": {
            return `a type ( () ) or a shorhand type (<>)`
        }
        default:
            return assertUnreachable(vt[0])
    }
}

export function printExpectErrorValue(vt: ExpectErrorValue): string {
    return `${printExpectErrorValueType(vt.type)}${vt["null allowed"] ? 'or null' : ''}`
}

export function printExpectError(issue: ExpectError): string {
    switch (issue[0]) {
        case "array is not a list": {
            return `expected a list: [ ]`
        }
        case "array is not a shorthand type": {
            return `expected a shorthand type: < >`
        }
        case "object is not a dictionary": {
            return `expected a dictionary: { }`
        }
        case "object is not a verbose type": {
            return `expected a verbose type: ( )`
        }
        case "invalid value type": {
            const $ = issue[1]
            return `expected ${printExpectErrorValue($.expected)} but found ${printExpectErrorValueType($.found)}`
        }
        case "invalid string": {
            const $ = issue[1]
            return `expected '${printExpectErrorValue($.expected)}' but found '${$.found}'`
        }
        case "duplicate property": {
            const $ = issue[1]
            return `duplicate property: '${$.name}'`
        }
        case "missing property": {
            const $ = issue[1]
            return `missing property: '${$.name}'`
        }
        case "unexpected property": {
            const $ = issue[1]
            return `unexpected property: '${$["found key"]}'. Choose from ${$["valid keys"].map($ => `'${$}'`).join(", ")}`
        }
        case "duplicate entry": {
            const $ = issue[1]
            return `duplicate entry: '${$.key}'`
        }
        case "expected token": {
            const $ = issue[1]
            const val = ((): string => {
                switch ($.token) {
                    case "open angle bracket": {
                        return '<'
                    }
                    case "open bracket": {
                        return '['
                    }
                    case "close bracket": {
                        return ']'
                    }
                    case "close angle bracket": {
                        return '>'
                    }
                    case "open curly": {
                        return '{'
                    }
                    case "close curly": {
                        return '}'
                    }
                    case "open paren": {
                        return '('
                    }
                    case "close paren": {
                        return ')'
                    }
                    default:
                        return assertUnreachable($.token[0])
                }
            })()
            return `expected '${val}' but found '${$.found}'`
        }
        case "not a valid number": {
            const $ = issue[1]
            return `'${$.value}' is not a valid number`
        }
        case "not a quoted string": {
            // const $ = issue[1]
            return `not a quoted string`
        }
        case "superfluous element": {
            //const $ = issue[1]
            return `superfluous element`
        }
        case "elements missing": {
            const $ = issue[1]
            return `${$.names.length} missing element(s): ${$.names.map($ => `'${$}'`).join(", ")}`
        }
        case "unknown option": {
            const $ = issue[1]
            return `unknown option '${$.found}', choose from ${$["valid options"].map($ => `'${$}'`).join(", ")} `
        }
        default:
            return assertUnreachable(issue[0])
    }
}
