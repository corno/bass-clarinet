/* eslint
    complexity:"off",
    no-underscore-dangle:"off",
*/

import { DataSubscriber } from "./Parser";
import { Range } from "./location";
import * as Char from "./NumberCharacters";

type OnError = (message: string, range: Range) => void

function assertUnreachable(_x: never) {
    throw new Error("unreachable")
}


function validateIsJSONNumber(value: string, raiseError: (message: string) => void) {
    if (value === "0") {
        return
    }
    if (value.startsWith("0")) {
        const nextChar = value.charCodeAt(1)
        if (nextChar !== Char.Number.period
            && nextChar !== Char.Number.e
            && nextChar !== Char.Number.E
        ) {
            raiseError(`Invalid number: Leading zero not followed by '.', 'e', 'E' in '${value}'`)
        }
    }
    if (value.startsWith("-0")) {
        const nextChar = value.charCodeAt(2)
        if (nextChar !== Char.Number.period
            && nextChar !== Char.Number.e
            && nextChar !== Char.Number.E
        ) {
            raiseError(`Invalid number: Leading negative zero not followed by '.', 'e', 'E' in '${value}'`)
        }
    }
    let foundPeriod = false
    let foundExponent = false
    for (let i = 0; i !== value.length; i += 1) {
        const curChar = value.charCodeAt(i)
        if (i === 0) {
            if (curChar !== Char.Number.minus && (curChar < Char.Number._0 || curChar > Char.Number._9)) {
                raiseError(`Invalid number, did not start with '-' or [0-9] but with ${value[i]}`)
            }
        } else {
            if (curChar === Char.Number.period) {
                if (foundPeriod) {
                    raiseError(`Invalid number, has two dots in '${value}'`)
                }
                foundPeriod = true
            } else if (curChar === Char.Number.e || curChar === Char.Number.E) {
                if (foundExponent) {
                    raiseError(`Invalid number, has two exponential in '${value}'`)
                }
                foundExponent = true
            } else if (curChar === Char.Number.plus || curChar === Char.Number.minus) {
                const previousChar = value.charCodeAt(i - 1)
                if (previousChar !== Char.Number.E && previousChar !== Char.Number.e) {
                    raiseError(`Invalid number, unexpected symbol ${value[i]} in '${value}'`)
                }
            } else {
                if (curChar < Char.Number._0 || curChar > Char.Number._9) {
                    raiseError(`Invalid number, unexpected character ${value[i]} in '${value}'`)
                }
            }
        }
    }
}

export enum ObjectState {
    EXPECTING_OBJECT_VALUE, // value in object
    EXPECTING_KEY_OR_OBJECT_END,
    EXPECTING_COMMA_OR_OBJECT_END, // , or }
    EXPECTING_KEY, // "a"
    EXPECTING_COLON, // :
}

export enum ArrayState {
    EXPECTING_ARRAYVALUE, // value in array
    EXPECTING_VALUE_OR_ARRAY_END,
    EXPECTING_COMMA_OR_ARRAY_END, // , or ]
}

type ContextType =
    | ["root", {
        //readonly valueHandler: ValueHandler
    }]
    | ["object", {
        state: ObjectState
        // valueHandler: null | ValueHandler
    }]
    | ["array", {
        state: ArrayState
    }]
    | ["taggedunion", {
        // readonly start: Range
        // readonly parentValueHandler: ValueHandler
        // valueHandler: null | ValueHandler
    }]

class StrictJSONValidator implements DataSubscriber {
    private readonly onError: OnError
    private readonly stack: ContextType[] = []
    private currentContext: ContextType = ["root", {}]


    constructor(onError: OnError) {
        this.onError = onError
    }
    public oncolon(range: Range) {
        if (this.currentContext[0] !== "object") {
            this.onError(`colon can only be used in objects`, range)
            return
        }
        if (this.currentContext[1].state !== ObjectState.EXPECTING_COLON) {
            this.onError(`did not expect a colon`, range)
        } else {
            this.currentContext[1].state = ObjectState.EXPECTING_OBJECT_VALUE
        }
    }
    public oncomma(range: Range) {
        switch (this.currentContext[0]) {
            case "array": {
                const $ = this.currentContext[1]
                if ($.state !== ArrayState.EXPECTING_COMMA_OR_ARRAY_END) {
                    this.onError(`did not expect a comma`, range)
                } else {
                    $.state = ArrayState.EXPECTING_ARRAYVALUE
                }
                break
            }
            case "object": {
                const $ = this.currentContext[1]
                if ($.state !== ObjectState.EXPECTING_COMMA_OR_OBJECT_END) {
                    this.onError(`did not expect a comma`, range)
                } else {
                    $.state = ObjectState.EXPECTING_OBJECT_VALUE
                }
                break
            }
            case "root": {
                //const $ = this.currentContext[1]
                this.onError(`did not expect a comma`, range)

                break
            }
            case "taggedunion": {
                //don't report
                break
            }
            default:
                return assertUnreachable(this.currentContext[0])
        }
    }
    public onblockcomment(_comment: string, range: Range, _indent: string) {
        this.onError("block comments are not allowed in strict JSON", range)
    }
    public onclosearray(range: Range, closeCharacter: string) {
        if (closeCharacter !== "]") {
            this.onError("arrays should end with ']' in strict JSON", range)
        }
        if (this.currentContext[0] !== "array") {
            this.onError("unpaired ']'", range)
        } else {
            if (this.currentContext[1].state === ArrayState.EXPECTING_ARRAYVALUE) {
                this.onError("trailing commas are not allowed", range)
            }
        }
        this.pop()
    }
    public oncloseobject(range: Range, closeCharacter: string) {
        if (closeCharacter !== "}") {
            this.onError("objects should end with '}' in strict JSON", range)
        }
        if (this.currentContext[0] !== "object") {
            this.onError("unpaired '}'", range)
        } else {
            if (this.currentContext[1].state === ObjectState.EXPECTING_KEY) {
                this.onError("trailing commas are not allowed", range)
            }
        }
        this.pop()
    }
    public onclosetaggedunion() {
        this.pop()
    }
    public onend() {
        //
    }
    public onkey(_key: string, range: Range) {
        if (this.currentContext[0] !== "object") {
            this.onError(`keys can only occur in objects`, range)
            return
        }
        this.currentContext[1].state = ObjectState.EXPECTING_COLON
    }
    public onlinecomment(_comment: string, range: Range) {
        this.onError("line comments are not allowed in strict JSON", range)
    }
    public onopenarray(range: Range, openCharacter: string) {
        if (openCharacter !== "[") {
            this.onError("arrays should start with '[' in strict JSON", range)
        }
        this.onvalue(range)
        this.push(["array", { state: ArrayState.EXPECTING_VALUE_OR_ARRAY_END }])

    }
    public onopenobject(range: Range, openCharacter: string) {
        if (openCharacter !== "{") {
            this.onError("objects should start with '{' in strict JSON", range)
        }
        this.onvalue(range)
        this.push(["object", { state: ObjectState.EXPECTING_KEY_OR_OBJECT_END }])
    }
    public onopentaggedunion(range: Range) {
        this.onError("tagged unions are not allowed in strict JSON", range)
        this.push(["taggedunion", {}])
    }
    public onoption(_option: string, _range: Range) {
        //
    }
    public onunquotedstring(value: string, range: Range) {
        this.onvalue(range)
        switch (value) {
            case "true": {
                return
            }
            case "false": {
                return
            }
            case "null": {
                return
            }
        }
        const firstChar = value.charCodeAt(0)
        if (firstChar === Char.Number.minus || Char.Number._0 <= firstChar && firstChar <= Char.Number._9) {
            validateIsJSONNumber(value, message => this.onError(message, range))
            return
        }
        this.onError(`invalid unquoted string, expected 'true', 'false', 'null', or a number`, range)
    }
    public onquotedstring(_value: string, quote: string, range: Range) {
        if (quote !== "\"") {
            this.onError(`invalid string, should start with'"'`, range)
        }
        this.onvalue(range)
    }
    private push(newContext: ContextType) {
        this.stack.push(this.currentContext)
        this.currentContext = newContext
    }

    private pop() {
        const previousContext = this.stack.pop()
        if (previousContext === undefined) {
            throw new Error("stack panic; lost context")
        }
        this.currentContext = previousContext
    }
    private onvalue(range: Range) {
        switch (this.currentContext[0]) {
            case "array": {
                const $ = this.currentContext[1]
                switch ($.state) {
                    case ArrayState.EXPECTING_ARRAYVALUE: {
                        //ok
                        break
                    }
                    case ArrayState.EXPECTING_COMMA_OR_ARRAY_END: {
                        this.onError(`expected comma or array end`, range)

                        break
                    }
                    case ArrayState.EXPECTING_VALUE_OR_ARRAY_END: {
                        //ok
                        break
                    }
                    default:
                        assertUnreachable($.state)
                }
                $.state = ArrayState.EXPECTING_COMMA_OR_ARRAY_END
                break
            }
            case "object": {
                const $ = this.currentContext[1]
                switch ($.state) {
                    case ObjectState.EXPECTING_COLON: {
                        this.onError(`expected colon`, range)
                        break
                    }
                    case ObjectState.EXPECTING_COMMA_OR_OBJECT_END: {
                        this.onError(`expected comma or object end`, range)
                        break
                    }
                    case ObjectState.EXPECTING_KEY: {
                        this.onError(`expected key`, range)
                        break
                    }
                    case ObjectState.EXPECTING_KEY_OR_OBJECT_END: {
                        this.onError(`expected key or array end`, range)
                        break
                    }
                    case ObjectState.EXPECTING_OBJECT_VALUE: {
                        //ok
                        break
                    }
                    default:
                        return assertUnreachable($.state)
                }
                $.state = ObjectState.EXPECTING_COMMA_OR_OBJECT_END
                break
            }
            case "root": {
                //const $ = this.currentContext[1]

                break
            }
            case "taggedunion": {
                //don't report. Tagged unions are not supported at all
                break
            }
            default:
                return assertUnreachable(this.currentContext[0])
        }
    }
}

export function createStrictJSONValidator(onError: OnError): DataSubscriber {
    return new StrictJSONValidator(onError)
}