/* eslint
    complexity:"off",
    no-underscore-dangle:"off",
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import { ParserEventType, ParserEvent } from "../ParserEvent"
import { HeaderConsumer, ParserEventConsumer } from "../createParser"
import { Range } from "../location"
import * as Char from "./NumberCharacters"
import { RangeError } from "../errors"

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
        if (nextChar !== Char.NumberCharacters.period
            && nextChar !== Char.NumberCharacters.e
            && nextChar !== Char.NumberCharacters.E
        ) {
            raiseError(`Invalid number: Leading zero not followed by '.', 'e', 'E' in '${value}'`)
        }
    }
    if (value.startsWith("-0")) {
        const nextChar = value.charCodeAt(2)
        if (nextChar !== Char.NumberCharacters.period
            && nextChar !== Char.NumberCharacters.e
            && nextChar !== Char.NumberCharacters.E
        ) {
            raiseError(`Invalid number: Leading negative zero not followed by '.', 'e', 'E' in '${value}'`)
        }
    }
    let foundPeriod = false
    let foundExponent = false
    for (let i = 0; i !== value.length; i += 1) {
        const curChar = value.charCodeAt(i)
        if (i === 0) {
            if (curChar !== Char.NumberCharacters.minus && (curChar < Char.NumberCharacters._0 || curChar > Char.NumberCharacters._9)) {
                raiseError(`Invalid number, did not start with '-' or [0-9] but with ${value[i]}`)
            }
        } else {
            if (curChar === Char.NumberCharacters.period) {
                if (foundPeriod) {
                    raiseError(`Invalid number, has two dots in '${value}'`)
                }
                foundPeriod = true
            } else if (curChar === Char.NumberCharacters.e || curChar === Char.NumberCharacters.E) {
                if (foundExponent) {
                    raiseError(`Invalid number, has two exponential in '${value}'`)
                }
                foundExponent = true
            } else if (curChar === Char.NumberCharacters.plus || curChar === Char.NumberCharacters.minus) {
                const previousChar = value.charCodeAt(i - 1)
                if (previousChar !== Char.NumberCharacters.E && previousChar !== Char.NumberCharacters.e) {
                    raiseError(`Invalid number, unexpected symbol ${value[i]} in '${value}'`)
                }
            } else {
                if (curChar < Char.NumberCharacters._0 || curChar > Char.NumberCharacters._9) {
                    raiseError(`Invalid number, unexpected character ${value[i]} in '${value}'`)
                }
            }
        }
    }
}

enum ObjectState {
    EXPECTING_OBJECT_VALUE, // value in object
    EXPECTING_KEY_OR_OBJECT_END,
    EXPECTING_COMMA_OR_OBJECT_END, // , or }
    EXPECTING_KEY, // "a"
    EXPECTING_COLON, // :
}

enum ArrayState {
    EXPECTING_ARRAYVALUE, // value in array
    EXPECTING_VALUE_OR_ARRAY_END,
    EXPECTING_COMMA_OR_ARRAY_END, // , or ]
}

enum TaggedUnionState {
    EXPECTING_OPTION,
    EXPECTING_DATA,
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
        state: TaggedUnionState
        // readonly start: Range
        // readonly parentValueHandler: ValueHandler
        // valueHandler: null | ValueHandler
    }]

class StrictJSONHeaderValidator implements HeaderConsumer<null, null> {
    private readonly onError: OnError


    constructor(onError: OnError) {
        this.onError = onError
    }
    onHeaderStart(range: Range) {
        this.onError(`headers are not allowed in strict JSON`, range)
        return {
            onData: () => {
                return p.result(false)
            },
            onEnd: () => {
                return p.success<null, null>(null)
            },
        }
    }
    onCompact() {
        //
    }
    onHeaderEnd() {
        return createStrictJSONValidator(this.onError)
    }
}

class StrictJSONValidator implements ParserEventConsumer<null, null> {
    private readonly onError: OnError
    private readonly stack: ContextType[] = []
    private currentContext: ContextType = ["root", {}]


    constructor(onError: OnError) {
        this.onError = onError
    }

    public onData(data: ParserEvent) {
        switch (data.type[0]) {
            case ParserEventType.BlockComment: {
                this.onError("block comments are not allowed in strict JSON", data.range)
                break
            }
            case ParserEventType.CloseArray: {
                const $ = data.type[1]
                if ($.closeCharacter !== "]") {
                    this.onError("arrays should end with ']' in strict JSON", data.range)
                }
                if (this.currentContext[0] !== "array") {
                    this.onError("unpaired ']'", data.range)
                } else {
                    if (this.currentContext[1].state === ArrayState.EXPECTING_ARRAYVALUE) {
                        this.onError("trailing commas are not allowed", data.range)
                    }
                }
                this.pop(data.range)
                this.wrapupValue(data.range)
                break
            }
            case ParserEventType.CloseObject: {
                const $ = data.type[1]
                if ($.closeCharacter !== "}") {
                    this.onError("objects should end with '}' in strict JSON", data.range)
                }
                if (this.currentContext[0] !== "object") {
                    this.onError("unpaired '}'", data.range)
                } else {
                    if (this.currentContext[1].state === ObjectState.EXPECTING_KEY) {
                        this.onError("trailing commas are not allowed in strict JSON", data.range)
                    }
                }
                this.pop(data.range)
                this.wrapupValue(data.range)
                break
            }
            case ParserEventType.Colon: {
                if (this.currentContext[0] !== "object") {
                    this.onError(`colon can only be used in objects`, data.range)
                } else {
                    if (this.currentContext[1].state !== ObjectState.EXPECTING_COLON) {
                        this.onError(`did not expect a colon`, data.range)
                    }
                    this.currentContext[1].state = ObjectState.EXPECTING_OBJECT_VALUE
                }
                break
            }
            case ParserEventType.Comma: {
                switch (this.currentContext[0]) {
                    case "array": {
                        const $$ = this.currentContext[1]
                        if ($$.state !== ArrayState.EXPECTING_COMMA_OR_ARRAY_END) {
                            this.onError(`did not expect a comma`, data.range)
                        }
                        $$.state = ArrayState.EXPECTING_ARRAYVALUE
                        break
                    }
                    case "object": {
                        const $$ = this.currentContext[1]
                        if ($$.state !== ObjectState.EXPECTING_COMMA_OR_OBJECT_END) {
                            this.onError(`did not expect a comma`, data.range)
                        }
                        $$.state = ObjectState.EXPECTING_KEY_OR_OBJECT_END
                        break
                    }
                    case "root": {
                        //const $ = this.currentContext[1]
                        this.onError(`did not expect a comma`, data.range)

                        break
                    }
                    case "taggedunion": {
                        //don't report
                        break
                    }
                    default:
                        assertUnreachable(this.currentContext[0])
                }
                break
            }
            case ParserEventType.LineComment: {
                this.onError("line comments are not allowed in strict JSON", data.range)
                break
            }
            case ParserEventType.NewLine: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.OpenArray: {
                const $ = data.type[1]
                if ($.openCharacter !== "[") {
                    this.onError("arrays should start with '[' in strict JSON", data.range)
                }
                this.onValue(data.range)
                this.push(["array", { state: ArrayState.EXPECTING_VALUE_OR_ARRAY_END }])
                break
            }
            case ParserEventType.OpenObject: {
                const $ = data.type[1]
                if ($.openCharacter !== "{") {
                    this.onError("objects should start with '{' in strict JSON", data.range)
                }
                this.onValue(data.range)
                this.push(["object", { state: ObjectState.EXPECTING_KEY_OR_OBJECT_END }])

                break
            }
            case ParserEventType.SimpleValue: {
                const $ = data.type[1]
                if ($.quote !== null) {
                    //a string
                    if ($.quote !== "\"") {
                        this.onError(`invalid string, should start with'"' in strict JSON`, data.range)
                    }
                    switch (this.currentContext[0]) {
                        case "array": {
                            this.onValue(data.range)
                            this.wrapupValue(data.range)
                            break
                        }
                        case "object": {
                            const $ = this.currentContext[1]
                            switch ($.state) {
                                case ObjectState.EXPECTING_COLON: {
                                    this.onValue(data.range)
                                    this.wrapupValue(data.range)
                                    break
                                }
                                case ObjectState.EXPECTING_COMMA_OR_OBJECT_END: {
                                    this.onError("missing comma", data.range)
                                    this.currentContext[1].state = ObjectState.EXPECTING_COLON
                                    break
                                }
                                case ObjectState.EXPECTING_KEY: {
                                    this.currentContext[1].state = ObjectState.EXPECTING_COLON
                                    break
                                }
                                case ObjectState.EXPECTING_KEY_OR_OBJECT_END: {
                                    this.currentContext[1].state = ObjectState.EXPECTING_COLON
                                    break
                                }
                                case ObjectState.EXPECTING_OBJECT_VALUE: {
                                    this.onValue(data.range)
                                    this.wrapupValue(data.range)
                                    break
                                }
                                default:
                                    assertUnreachable($.state[0])
                            }
                            break
                        }
                        case "root": {
                            //const $ = this.currentContext[1]
                            this.onValue(data.range)
                            this.wrapupValue(data.range)
                            break
                        }
                        case "taggedunion": {
                            const $ = this.currentContext[1]
                            switch ($.state) {
                                case TaggedUnionState.EXPECTING_OPTION: {
                                    $.state = TaggedUnionState.EXPECTING_DATA
                                    break
                                }
                                case TaggedUnionState.EXPECTING_DATA: {

                                    break
                                }
                                default:
                                    assertUnreachable($.state)
                            }

                            break
                        }
                        default:
                            assertUnreachable(this.currentContext[0])
                    }
                } else {
                    //no quotes
                    this.onValue(data.range)
                    switch ($.value) {
                        case "true": {
                            break
                        }
                        case "false": {
                            break
                        }
                        case "null": {
                            break
                        }
                        default:
                            const firstChar = $.value.charCodeAt(0)
                            if (firstChar === Char.NumberCharacters.minus || Char.NumberCharacters._0 <= firstChar && firstChar <= Char.NumberCharacters._9) {
                                validateIsJSONNumber($.value, message => this.onError(message, data.range))
                            } else {
                                this.onError(`invalid unquoted token, expected 'true', 'false', 'null', or a number`, data.range)
                                this.wrapupValue(data.range)
                            }
                    }
                }
                break
            }
            case ParserEventType.TaggedUnion: {
                this.onError("tagged unions are not allowed in strict JSON", data.range)
                this.push(["taggedunion", { state: TaggedUnionState.EXPECTING_OPTION }])
                break
            }
            case ParserEventType.WhiteSpace: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return p.result(false)
    }
    public onEnd() {
        return p.success<null, null>(null)
    }
    private push(newContext: ContextType) {
        this.stack.push(this.currentContext)
        this.currentContext = newContext
    }

    private pop(range: Range) {
        const previousContext = this.stack.pop()
        if (previousContext === undefined) {
            throw new RangeError("stack panic; lost context", range)
        }
        this.currentContext = previousContext
    }
    private wrapupValue(range: Range) {
        switch (this.currentContext[0]) {
            case "array": {
                const $ = this.currentContext[1]
                $.state = ArrayState.EXPECTING_COMMA_OR_ARRAY_END
                break
            }
            case "object": {
                const $ = this.currentContext[1]
                $.state = ObjectState.EXPECTING_COMMA_OR_OBJECT_END
                break
            }
            case "root": {
                break
            }
            case "taggedunion": {
                //don't report. Tagged unions are not supported at all
                this.pop(range)
                break
            }
            default:
                return assertUnreachable(this.currentContext[0])
        }
    }
    private onValue(range: Range) {
        switch (this.currentContext[0]) {
            case "array": {
                const $ = this.currentContext[1]
                switch ($.state) {
                    case ArrayState.EXPECTING_ARRAYVALUE: {
                        //ok
                        break
                    }
                    case ArrayState.EXPECTING_COMMA_OR_ARRAY_END: {
                        this.onError(`commas are required between elements in strict JSON`, range)

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
                        this.onError(`a colon is required in strict JSON`, range)
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
                        this.onError(`expected key or object end`, range)
                        break
                    }
                    case ObjectState.EXPECTING_OBJECT_VALUE: {
                        //ok
                        break
                    }
                    default:
                        assertUnreachable($.state)
                }
                $.state = ObjectState.EXPECTING_COMMA_OR_OBJECT_END
                break
            }
            case "root": {
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

export function createStrictJSONHeaderValidator(onError: OnError): HeaderConsumer<null, null> {
    return new StrictJSONHeaderValidator(onError)
}

export function createStrictJSONValidator(onError: OnError): ParserEventConsumer<null, null> {
    return new StrictJSONValidator(onError)
}