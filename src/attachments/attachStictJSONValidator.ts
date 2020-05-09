/* eslint
    complexity:"off",
    no-underscore-dangle:"off",
    max-classes-per-file: "off",
*/
import { IDataSubscriber, OpenData, CloseData, StringData, SimpleMetaData, CommentMetaData } from "../IDataSubscriber"
import { Parser, HeaderSubscriber } from "../Parser"
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

export enum TaggedUnionState {
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

class StrictJSONHeaderValidator implements HeaderSubscriber {
    private readonly onError: OnError


    constructor(onError: OnError) {
        this.onError = onError
    }
    onHeaderStart(range: Range) {
        this.onError(`headers are not allowed in strict JSON`, range)
    }
    onCompact() {
        //
    }
    onHeaderEnd() {
        //
    }
}

class StrictJSONValidator implements IDataSubscriber {
    private readonly onError: OnError
    private readonly stack: ContextType[] = []
    private currentContext: ContextType = ["root", {}]


    constructor(onError: OnError) {
        this.onError = onError
    }
    public onColon(metaData: SimpleMetaData) {
        if (this.currentContext[0] !== "object") {
            this.onError(`colon can only be used in objects`, metaData. range)
            return
        }
        if (this.currentContext[1].state !== ObjectState.EXPECTING_COLON) {
            this.onError(`did not expect a colon`, metaData.range)
        }
        this.currentContext[1].state = ObjectState.EXPECTING_OBJECT_VALUE
    }
    public onComma(metaData: SimpleMetaData) {
        switch (this.currentContext[0]) {
            case "array": {
                const $ = this.currentContext[1]
                if ($.state !== ArrayState.EXPECTING_COMMA_OR_ARRAY_END) {
                    this.onError(`did not expect a comma`, metaData.range)
                }
                $.state = ArrayState.EXPECTING_ARRAYVALUE
                break
            }
            case "object": {
                const $ = this.currentContext[1]
                if ($.state !== ObjectState.EXPECTING_COMMA_OR_OBJECT_END) {
                    this.onError(`did not expect a comma`, metaData.range)
                }
                $.state = ObjectState.EXPECTING_KEY_OR_OBJECT_END
                break
            }
            case "root": {
                //const $ = this.currentContext[1]
                this.onError(`did not expect a comma`, metaData.range)

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
    public onBlockComment(_comment: string, metaData: CommentMetaData) {
        this.onError("block comments are not allowed in strict JSON", metaData.outerRange)
    }
    public onCloseArray(metaData: CloseData) {
        if (metaData.closeCharacter !== "]") {
            this.onError("arrays should end with ']' in strict JSON", metaData.range)
        }
        if (this.currentContext[0] !== "array") {
            this.onError("unpaired ']'", metaData.range)
        } else {
            if (this.currentContext[1].state === ArrayState.EXPECTING_ARRAYVALUE) {
                this.onError("trailing commas are not allowed", metaData.range)
            }
        }
        this.pop(metaData.range)
        this.wrapupValue(metaData.range)
    }
    public onCloseObject(metaData: CloseData) {
        if (metaData.closeCharacter !== "}") {
            this.onError("objects should end with '}' in strict JSON", metaData.range)
        }
        if (this.currentContext[0] !== "object") {
            this.onError("unpaired '}'", metaData.range)
        } else {
            if (this.currentContext[1].state === ObjectState.EXPECTING_KEY) {
                this.onError("trailing commas are not allowed in strict JSON", metaData.range)
            }
        }
        this.pop(metaData.range)
        this.wrapupValue(metaData.range)
    }
    public onEnd() {
        //
    }
    public onNewLine() {
        //
    }
    public onWhitespace() {
        //
    }
    public onLineComment(_comment: string, metaData: CommentMetaData) {
        this.onError("line comments are not allowed in strict JSON", metaData.outerRange)
    }
    public onOpenArray(metaData: OpenData) {
        if (metaData.openCharacter !== "[") {
            this.onError("arrays should start with '[' in strict JSON", metaData.range)
        }
        this.onValue(metaData.range)
        this.push(["array", { state: ArrayState.EXPECTING_VALUE_OR_ARRAY_END }])

    }
    public onOpenObject(metaData: OpenData) {
        if (metaData.openCharacter !== "{") {
            this.onError("objects should start with '{' in strict JSON", metaData.range)
        }
        this.onValue(metaData.range)
        this.push(["object", { state: ObjectState.EXPECTING_KEY_OR_OBJECT_END }])
    }
    public onOpenTaggedUnion(metaData: SimpleMetaData) {
        this.onError("tagged unions are not allowed in strict JSON", metaData.range)
        this.push(["taggedunion", { state: TaggedUnionState.EXPECTING_OPTION }])
    }
    public onString(value: string, metaData: StringData) {
        if (metaData.quote !== null) {
            //a string
            if (metaData.quote !== "\"") {
                this.onError(`invalid string, should start with'"' in strict JSON`, metaData.range)
            }
            switch (this.currentContext[0]) {
                case "array": {
                    this.onValue(metaData.range)
                    this.wrapupValue(metaData.range)
                    break
                }
                case "object": {
                    const $ = this.currentContext[1]
                    switch ($.state) {
                        case ObjectState.EXPECTING_COLON: {
                            this.onValue(metaData.range)
                            this.wrapupValue(metaData.range)
                            break
                        }
                        case ObjectState.EXPECTING_COMMA_OR_OBJECT_END: {
                            this.onError("missing comma", metaData.range)
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
                            this.onValue(metaData.range)
                            this.wrapupValue(metaData.range)
                            break
                        }
                        default:
                            return assertUnreachable($.state[0])
                    }
                    break
                }
                case "root": {
                    //const $ = this.currentContext[1]
                    this.onValue(metaData.range)
                    this.wrapupValue(metaData.range)
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
                            return assertUnreachable($.state)
                    }

                    break
                }
                default:
                    return assertUnreachable(this.currentContext[0])
            }
        } else {
            this.onValue(metaData.range)
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
                validateIsJSONNumber(value, message => this.onError(message, metaData.range))
                return
            }
            this.onError(`invalid unquoted token, expected 'true', 'false', 'null', or a number`, metaData.range)
            this.wrapupValue(metaData.range)
        }
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

export function attachStrictJSONValidator(parser: Parser, onError: OnError) {
    parser.onheaderdata.subscribe(new StrictJSONHeaderValidator(onError))
    parser.ondata.subscribe(new StrictJSONValidator(onError))
}