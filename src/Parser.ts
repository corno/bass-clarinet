import * as s from "./subscription"

const env: any = (typeof process === 'object' && process.env)
    ? process.env
    : self

export function parser(opt?: Options) { return new Parser(opt) }
export const MAX_BUFFER_LENGTH = 64 * 1024
const maxAllowed = Math.max(MAX_BUFFER_LENGTH, 10)
export const DEBUG = (env.CDEBUG === 'debug')
export const INFO = (env.CDEBUG === 'debug' || env.CDEBUG === 'info')

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export type Options = {
    spaces_per_tab?: number
    allow_trailing_commas?: boolean
    allow_comments?: boolean
}

export enum GlobalStateType {
    ERROR,
    COMMENT,
    STRING,
    NUMBER,
    KEYWORD,
    OTHER,
}

enum OtherState {
    EXPECTING_ROOTVALUE, // value at the root
    END, // no more input expected

    EXPECTING_OBJECTVALUE, // value in object
    EXPECTING_KEY_OR_OBJECT_END,
    EXPECTING_COMMA_OR_OBJECT_END, // , or }
    EXPECTING_KEY, // "a"
    EXPECTING_COLON, // :

    EXPECTING_ARRAYVALUE, // value in array
    EXPECTING_VALUE_OR_ARRAY_END,
    EXPECTING_COMMA_OR_ARRAY_END, // , or ]
}

enum KeywordState {
    TRUE, // r
    TRUE2, // u
    TRUE3, // e

    FALSE, // a
    FALSE2, // l
    FALSE3, // s
    FALSE4, // e

    NULL, // u
    NULL2, // l
    NULL3, // l
}

type GlobalState =
    | [GlobalStateType.ERROR, {
        error: Error
    }]
    | [GlobalStateType.NUMBER, {
        start: Location
        numberNode: string
        nextState: OtherState
        foundExponent: boolean
        foundPeriod: boolean
    }]
    | [GlobalStateType.KEYWORD, {
        nextState: OtherState
        state: KeywordState
    }]
    | [GlobalStateType.STRING, {
        start: Location
        textNode: string
        stringType: StringType
        nextState: OtherState
        unicode: null | Unicode
        slashed: boolean // = false
    }]
    | [GlobalStateType.OTHER, OtherStateData]

type OtherStateData = {
    state: OtherState
}

function getStateDescription(s: GlobalState) {
    switch (s[0]) {
        case GlobalStateType.ERROR: return "ERROR"
        case GlobalStateType.NUMBER: return "NUMBER"
        case GlobalStateType.STRING: return "STRING"
        case GlobalStateType.KEYWORD: {
            switch (s[1].state) {
                case KeywordState.TRUE: return "TRUE"
                case KeywordState.TRUE2: return "TRUE2"
                case KeywordState.TRUE3: return "TRUE3"
                case KeywordState.FALSE: return "FALSE"
                case KeywordState.FALSE2: return "FALSE2"
                case KeywordState.FALSE3: return "FALSE3"
                case KeywordState.FALSE4: return "FALSE4"
                case KeywordState.NULL: return "NULL"
                case KeywordState.NULL2: return "NULL2"
                case KeywordState.NULL3: return "NULL3"
                default: return assertUnreachable(s[1].state)
            }
        }
        case GlobalStateType.OTHER: {

            switch (s[1].state) {
                case OtherState.END: return "END"
                case OtherState.EXPECTING_ROOTVALUE: return "EXPECTING_ROOTVALUE"
                case OtherState.EXPECTING_OBJECTVALUE: return "EXPECTING_OBJECTVALUE"
                case OtherState.EXPECTING_ARRAYVALUE: return "EXPECTING_ARRAYVALUE"
                case OtherState.EXPECTING_KEY_OR_OBJECT_END: return "EXPECTING_KEY_OR_OBJECT_END"
                case OtherState.EXPECTING_COMMA_OR_OBJECT_END: return "EXPECTING_COMMA_OR_OBJECT_END"
                case OtherState.EXPECTING_VALUE_OR_ARRAY_END: return "EXPECTING_VALUE_OR_ARRAY_END"
                case OtherState.EXPECTING_COMMA_OR_ARRAY_END: return "EXPECTING_COMMA_OR_ARRAY_END"
                case OtherState.EXPECTING_KEY: return "EXPECTING_KEY"
                case OtherState.EXPECTING_COLON: return "EXPECTING_COLON"
                default: return assertUnreachable(s[1].state)

            }
        }
        default: return assertUnreachable(s[0])

    }
}

enum StringType {
    KEY,
    VALUE,
}

const CommentChar = {
    solidus: 0x2F,           // /
    asterisk: 0x2A,          // *
}

const WhitespaceChar = {
    tab: 0x09,               // \t
    lineFeed: 0x0A,          // \n
    carriageReturn: 0x0D,    // \r
    space: 0x20,             // " "
}

const NumberChar = {

    plus: 0x2B,              // +
    minus: 0x2D,             // -
    period: 0x2E,            // .

    _0: 0x30,                // 0
    _9: 0x39,                // 9
    e: 0x65,                 // e 
    E: 0x45,                 // E
}

const KeywordChar = {
    a: 0x61,                 // a
    e: 0x65,                 // e 
    f: 0x66,                 // f
    l: 0x6C,                 // l
    n: 0x6E,                 // n
    r: 0x72,                 // r
    s: 0x73,                 // s
    t: 0x74,                 // t
    u: 0x75,                 // u
}

const StringChar = {
    quotationMark: 0x22,     // "
    reverseSolidus: 0x5C,    // \
    solidus: 0x2F,           // /

    b: 0x62,                 // b
    f: 0x66,                 // f
    n: 0x6E,                 // n
    r: 0x72,                 // r
    t: 0x74,                 // t
    u: 0x75,                 // u
}

const Char = {
    comma: 0x2C,             // ,
    colon: 0x3A,             // :
    openBracket: 0x5B,       // [
    closeBracket: 0x5D,      // ]
    openBrace: 0x7B,         // {
    closeBrace: 0x7D,        // }
}

enum ContextType {
    ROOT,
    OBJECT,
    ARRAY,
}

export type Location = {
    readonly position: number,
    readonly line: number,
    readonly column: number,
}

export type Range = {
    start: Location
    end: Location
}


type Event =
    | "ready"
    | "end"
    | "error"
    | "openobject"
    | "closeobject"
    | "openarray"
    | "closearray"
    | "key"
    | "value"

type Unicode = {
    charactersLeft: number
    foundCharacters: ""
}

enum CommentState {
    FOUND_SLASH,
    FOUND_ASTERISK,
    LINE_COMMENT,
    BLOCK_COMMENT
}


export class Parser {

    private bufferCheckPosition = MAX_BUFFER_LENGTH
    private curChar = 0
    closed = false
    readonly opt: Options

    private readonly stack = new Array<ContextType>()
    // mostly just for error reporting
    public position = 0
    public column = 0
    public line = 1

    public state: GlobalState = [GlobalStateType.OTHER, {
        state: OtherState.EXPECTING_ROOTVALUE
    }]

    commentState: CommentState | null = null


    onclosearray = new s.OneArgumentSubscribers<Location>()
    onopenarray = new s.OneArgumentSubscribers<Location>()
    oncloseobject = new s.OneArgumentSubscribers<Location>()
    onopenobject = new s.OneArgumentSubscribers<Location>()
    onkey = new s.TwoArgumentsSubscribers<string, Range>()
    onvalue = new s.TwoArgumentsSubscribers<string | boolean | null | number, Range>()

    onend = new s.NoArgumentSubscribers()
    onerror = new s.OneArgumentSubscribers<Error>()
    onready = new s.NoArgumentSubscribers()

    private currentContextType = ContextType.ROOT

    constructor(opt?: Options) {
        this.opt = opt || {}
        if (INFO) console.log('-- emit', "onready")
        this.onready.signal()
    }

    public subscribe(event: Event, subscriber: (data?: any) => void) {
        switch (event) {
            case "closearray":
                this.onclosearray.subscribers.push(subscriber)
                break
            case "openarray":
                this.onopenarray.subscribers.push(subscriber)
                break
            case "closeobject":
                this.oncloseobject.subscribers.push(subscriber)
                break
            case "openobject":
                this.onopenobject.subscribers.push(subscriber)
                break
            case "end":
                this.onend.subscribers.push(subscriber)
                break
            case "value":
                this.onvalue.subscribers.push(subscriber)
                break
            case "ready":
                this.onready.subscribers.push(subscriber)
                break
            case "error":
                this.onerror.subscribers.push(subscriber)
                break
            case "key":
                this.onkey.subscribers.push(subscriber)
                break
            default:
                assertUnreachable(event)
        }
    }

    public write(chunk: string): Parser {
        if (this.state[0] === GlobalStateType.ERROR) {
            throw this.state[1].error
        }
        if (this.closed) {
            this.raiseError("Cannot write after close. Assign an onready handler.")
            return this
        }
        if (DEBUG) console.log('write -> [\'' + chunk + '\']')
        this.processChunk(chunk)
        if (this.position >= this.bufferCheckPosition) {
            switch (this.state[0]) {
                case GlobalStateType.NUMBER: {
                    const $ = this.state[1]
                    if ($.numberNode.length > maxAllowed) {
                        this.raiseError("Max number buffer length exceeded: " + $.numberNode.length)
                    } else {
                        this.bufferCheckPosition = this.position + MAX_BUFFER_LENGTH - $.numberNode.length

                    }
                    break
                }
                case GlobalStateType.STRING: {
                    const $ = this.state[1]
                    if ($.textNode.length > maxAllowed) {
                        this.raiseError("Max string buffer length exceeded: " + $.textNode.length)
                    } else {
                        this.bufferCheckPosition = this.position + MAX_BUFFER_LENGTH - $.textNode.length
                    }
                    break
                }
            }
        }
        return this
    }

    private processChunk(chunk: string): void {

        //initialize

        //start at the position just before the first character
        //because we are going to call next() once at the beginning
        let currentChunkIndex = -1
        let curChar: number = 0


        const next = () => {

            currentChunkIndex++

            curChar = chunk.charCodeAt(currentChunkIndex)
            this.curChar = curChar

            if (DEBUG) console.log(currentChunkIndex, curChar, String.fromCharCode(curChar), this.commentState === null ? "" : "*comment*", getStateDescription(this.state), this.position, this.line, this.column)
            if (!isNaN(curChar)) {
                this.position++
                switch (curChar) {
                    case WhitespaceChar.lineFeed:
                        this.line++
                        this.column = 0
                        break
                    case WhitespaceChar.carriageReturn:
                        break
                    case WhitespaceChar.tab:
                        const tab = (this.opt.spaces_per_tab) ? this.opt.spaces_per_tab : 4
                        this.column += tab
                        break
                    default:
                        this.column++
                }
            }
        }
        next()
        while (true) {
            if (isNaN(curChar)) {
                //end of chunk reached
                return
            }

            if (this.commentState !== null) {
                switch (this.commentState) {
                    case CommentState.BLOCK_COMMENT:
                        if (curChar === CommentChar.asterisk) {
                            this.commentState = CommentState.FOUND_ASTERISK
                        }
                        break
                    case CommentState.LINE_COMMENT:
                        if (curChar === WhitespaceChar.lineFeed) {
                            console.log("HIER???")
                            this.commentState = null
                        }
                        break
                    case CommentState.FOUND_ASTERISK:
                        if (curChar === CommentChar.solidus) {
                            this.commentState = null
                        }
                        break
                    case CommentState.FOUND_SLASH:
                        if (curChar === CommentChar.solidus) {
                            this.commentState = CommentState.LINE_COMMENT
                        } else if (curChar === CommentChar.asterisk) {
                            this.commentState = CommentState.BLOCK_COMMENT
                        }
                        break
                    default: assertUnreachable(this.commentState)
                }
                next()
            } else {
                const state = this.state
                switch (state[0]) {
                    case GlobalStateType.ERROR: {
                        return
                    }
                    case GlobalStateType.NUMBER: {
                        /**
                         * NUMBER PROCESSING
                         */
                        const $ = state[1]
                        while (true) {
                            if (isNaN(curChar)) {
                                return
                            }
                            //if (DEBUG) console.log(currentChunkIndex, curChar, String.fromCharCode(curChar), 'number loop')

                            //first check if we are breaking out of a number. Can only be done by checking the character that comes directly after the number
                            if (curChar !== NumberChar.period
                                && curChar !== NumberChar.e
                                && curChar !== NumberChar.E
                                && curChar !== NumberChar.plus
                                && curChar !== NumberChar.minus
                                && !(NumberChar._0 <= curChar && curChar <= NumberChar._9)
                            ) {
                                this.onvalue.signal(new Number(state[1].numberNode).valueOf(), {
                                    start: $.start,
                                    end: {
                                        line: this.line,
                                        position: this.position - 1,
                                        column: this.column - 1
                                    }
                                })
                                this.state = [GlobalStateType.OTHER, { state: state[1].nextState }]
                                //this character does not belong to the number so don't go to the next character
                                break
                            } else {
                                if ($.numberNode === "-0" || $.numberNode === "0") {
                                    if (curChar !== NumberChar.period
                                        && curChar !== NumberChar.e
                                        && curChar !== NumberChar.E
                                    ) {
                                        this.raiseError(`Leading zero not followed by '.', 'e', 'E', ',' ']', '}' or whitespace`)
                                    }
                                }
                                if (curChar === NumberChar.period) {
                                    if ($.foundPeriod) {
                                        this.raiseError('Invalid number, has two dots')
                                    }
                                    $.foundPeriod = true
                                } else if (curChar === NumberChar.e || curChar === NumberChar.E) {
                                    if ($.foundExponent) {
                                        this.raiseError('Invalid number, has two exponential')
                                    }
                                    $.foundExponent = true
                                } else if (curChar === NumberChar.plus || curChar === NumberChar.minus) {
                                    if ($.numberNode[$.numberNode.length - 1] !== "e" && $.numberNode[$.numberNode.length - 1] !== "E") {
                                        this.raiseError('Invalid symbol in number')
                                    }
                                }
                                $.numberNode += String.fromCharCode(curChar)
                                next()
                            }
                        }

                        break
                    }
                    case GlobalStateType.STRING: {
                        /**
                         * STRING PROCESSING
                         */
                        const $ = state[1]

                        let snippetStart: null | number = null
                        function flush() {
                            if (snippetStart !== null) {
                                $.textNode += chunk.substring(snippetStart, currentChunkIndex)
                            }
                            snippetStart = null
                        }

                        while (true) {
                            //if (DEBUG) console.log(currentChunkIndex, curChar, String.fromCharCode(curChar), 'string loop', $.slashed, $.textNode)

                            if (isNaN(curChar)) {
                                //end of the chunk
                                //store it and wait for more input
                                flush()
                                return
                            }
                            if ($.unicode !== null) {
                                $.unicode.foundCharacters += String.fromCharCode(curChar)
                                $.unicode.charactersLeft--
                                if ($.unicode.charactersLeft === 0) {
                                    $.textNode += String.fromCharCode(parseInt($.unicode.foundCharacters, 16))
                                    $.unicode = null
                                }
                            } else {
                                if ($.slashed) {
                                    if (curChar === StringChar.quotationMark) { $.textNode += '\"' }
                                    else if (curChar === StringChar.reverseSolidus) { $.textNode += '\\' }
                                    else if (curChar === StringChar.solidus) { $.textNode += '\/' }
                                    else if (curChar === StringChar.b) { $.textNode += '\b' }
                                    else if (curChar === StringChar.f) { $.textNode += '\f' }
                                    else if (curChar === StringChar.n) { $.textNode += '\n' }
                                    else if (curChar === StringChar.r) { $.textNode += '\r' }
                                    else if (curChar === StringChar.t) { $.textNode += '\t' }
                                    else if (curChar === StringChar.u) {
                                        // \uxxxx. meh!
                                        $.unicode = {
                                            charactersLeft: 4,
                                            foundCharacters: ""
                                        }
                                    }
                                    else {
                                        //no special character
                                        this.raiseError("expected special character after escape slash")
                                    }
                                    $.slashed = false
                                } else {

                                    //not slashed, not unicode
                                    if (curChar === StringChar.reverseSolidus) {//backslash
                                        flush()
                                        $.slashed = true
                                    } else if (curChar === StringChar.quotationMark) {
                                        /**
                                         * THE STRING IS FINISHED
                                         */

                                        flush()
                                        const locationInfo = {
                                            start: $.start,
                                            end: this.getLocation()
                                        }
                                        if ($.stringType === StringType.KEY) {
                                            this.onkey.signal($.textNode, locationInfo)
                                        } else {
                                            this.onvalue.signal($.textNode, locationInfo)
                                        }
                                        this.state = [GlobalStateType.OTHER, { state: $.nextState }]
                                        next()
                                        break
                                    } else {
                                        //normal character
                                        //don't flush
                                        if (snippetStart === null) {
                                            snippetStart = currentChunkIndex
                                        }
                                    }
                                }
                            }
                            next()
                        }
                        break
                    }
                    case GlobalStateType.KEYWORD: {
                        /**
                         * KEYWORD PROCESSING (null, true, false)
                         */
                        const $ = state[1]
                        switch ($.state) {

                            case KeywordState.TRUE:
                                if (curChar === KeywordChar.r) $.state = KeywordState.TRUE2
                                else {
                                    this.raiseError('Invalid true started with t' + curChar)
                                }
                                break
                            case KeywordState.TRUE2:
                                if (curChar === KeywordChar.u) $.state = KeywordState.TRUE3
                                else {
                                    this.raiseError('Invalid true started with tr' + curChar)
                                }
                                break

                            case KeywordState.TRUE3:
                                if (curChar === KeywordChar.e) {
                                    this.finishKeyword(true, $.nextState, "true".length)
                                } else {
                                    this.raiseError('Invalid true started with tru' + curChar)
                                }
                                break

                            case KeywordState.FALSE:
                                if (curChar === KeywordChar.a) $.state = KeywordState.FALSE2
                                else {
                                    this.raiseError('Invalid false started with f' + curChar)
                                }
                                break

                            case KeywordState.FALSE2:
                                if (curChar === KeywordChar.l) $.state = KeywordState.FALSE3
                                else {
                                    this.raiseError('Invalid false started with fa' + curChar)
                                }
                                break

                            case KeywordState.FALSE3:
                                if (curChar === KeywordChar.s) $.state = KeywordState.FALSE4
                                else {
                                    this.raiseError('Invalid false started with fal' + curChar)
                                }
                                break

                            case KeywordState.FALSE4:
                                if (curChar === KeywordChar.e) {
                                    this.finishKeyword(false, $.nextState, "false".length)
                                } else {
                                    this.raiseError('Invalid false started with fals' + curChar)
                                }
                                break

                            case KeywordState.NULL:
                                if (curChar === KeywordChar.u) $.state = KeywordState.NULL2
                                else {
                                    this.raiseError('Invalid null started with n' + curChar)
                                }
                                break

                            case KeywordState.NULL2:
                                if (curChar === KeywordChar.l) $.state = KeywordState.NULL3
                                else {
                                    this.raiseError('Invalid null started with nu' + curChar)
                                }
                                break

                            case KeywordState.NULL3:
                                if (curChar === KeywordChar.l) {
                                    this.finishKeyword(null, $.nextState, "null".length)
                                } else {
                                    this.raiseError('Invalid null started with nul' + curChar)
                                }
                                break
                            default:
                                return assertUnreachable($.state)

                        }
                        next()
                        break
                    }
                    case GlobalStateType.OTHER: {
                        /**
                         * ROOT, OBJECT, ARRAY PROCESSING
                         */
                        while (curChar === WhitespaceChar.carriageReturn || curChar === WhitespaceChar.lineFeed || curChar === WhitespaceChar.space || curChar === WhitespaceChar.tab) {
                            next()
                            if (isNaN(curChar)) {
                                return
                            }
                        }
                        if (curChar === CommentChar.solidus) {
                            if (this.opt.allow_comments) {
                                this.commentState = CommentState.FOUND_SLASH
                            } else {
                                this.raiseError("comments are not allowed. You can allow comments by setting the option 'allow_comments'")
                            }
                        } else {
                            const $ = state[1]
                            switch ($.state) {
                                case OtherState.EXPECTING_KEY:
                                    if (curChar === Char.closeBrace) {
                                        if (this.opt.allow_trailing_commas !== true) {
                                            this.raiseError("trailing commas are not allowed")
                                        } else {
                                            this.oncloseobject.signal(this.getLocation())
                                            this.pop($)
                                        }
                                    } else {
                                        this.processKey(curChar)
                                    }

                                    break
                                case OtherState.EXPECTING_KEY_OR_OBJECT_END:
                                    if (curChar === Char.closeBrace) {
                                        this.oncloseobject.signal(this.getLocation())
                                        this.pop($)
                                    } else {
                                        this.processKey(curChar)
                                    }
                                    break
                                case OtherState.EXPECTING_COLON:
                                    if (curChar === Char.colon) {
                                        $.state = OtherState.EXPECTING_OBJECTVALUE
                                    } else {
                                        this.raiseError(`Expected colon, found ${String.fromCharCode(curChar)}`)
                                    }
                                    break
                                case OtherState.EXPECTING_COMMA_OR_OBJECT_END:
                                    if (curChar === Char.closeBrace) {
                                        this.oncloseobject.signal(this.getLocation())
                                        this.pop($)
                                    } else if (curChar === Char.comma) {
                                        $.state = OtherState.EXPECTING_KEY
                                    } else {
                                        this.raiseError(`Expected ',' or '}', found ${String.fromCharCode(curChar)}`)
                                    }
                                    break
                                case OtherState.EXPECTING_VALUE_OR_ARRAY_END:
                                    if (curChar === Char.closeBracket) {
                                        this.onclosearray.signal(this.getLocation())
                                        this.pop($)
                                        break
                                    } else {
                                        this.processValue(curChar, OtherState.EXPECTING_COMMA_OR_ARRAY_END)
                                    }
                                    break
                                case OtherState.EXPECTING_ROOTVALUE:
                                    this.processValue(curChar, OtherState.END)
                                    break
                                case OtherState.EXPECTING_OBJECTVALUE:
                                    this.processValue(curChar, OtherState.EXPECTING_COMMA_OR_OBJECT_END)
                                    break
                                case OtherState.EXPECTING_ARRAYVALUE:
                                    if (curChar === Char.closeBracket) {
                                        if (this.opt.allow_trailing_commas !== true) {
                                            this.raiseError("trailing commas are not allowed")
                                        } else {
                                            this.onclosearray.signal(this.getLocation())
                                            this.pop($)
                                        }
                                    } else {
                                        this.processValue(curChar, OtherState.EXPECTING_COMMA_OR_ARRAY_END)
                                    }
                                    break
                                case OtherState.EXPECTING_COMMA_OR_ARRAY_END:
                                    if (curChar === Char.comma) {
                                        $.state = OtherState.EXPECTING_ARRAYVALUE
                                    } else if (curChar === Char.closeBracket) {
                                        this.onclosearray.signal(this.getLocation())
                                        this.pop($)
                                    }
                                    else {
                                        this.raiseError(`Bad array, expected ',' or ']'`)
                                    }
                                    break

                                case OtherState.END: {
                                    this.raiseError(`Unexpected data after end`)
                                    break
                                }
                                default:
                                    return assertUnreachable($.state)
                            }
                        }
                        next()
                        break
                    }
                    default: assertUnreachable(state[0])
                }
            }
        }
    }
    // public resume() {
    //     this.error = null
    //     return this
    // }
    public close() {
        if (this.state[0] === GlobalStateType.ERROR) {
            throw this.state[1].error
        }
        if (this.closed) {
            this.raiseError("Already closed.")
        }
        return this.end()
    }

    private getLocation(): Location {
        return {
            position: this.position,
            line: this.line,
            column: this.column,
        }
    }

    private raiseError(er: string) {
        er += `
        Line: ${this.line}
        Column: ${this.column}
        Char: '${String.fromCharCode(this.curChar)}'
        Char#: ${this.curChar}`
        const error = new Error(er)
        this.state = [GlobalStateType.ERROR, { error: error }]
        this.onerror.signal(error)
    }
    private finishKeyword(value: false | true | null, nextState: OtherState, length: number) {
        const curLoc = this.getLocation()
        this.onvalue.signal(value, {
            start: {
                line: curLoc.line,
                position: curLoc.position - length + 1, //plus 1 because a string of say 4 characters starting at 5 and ends at 8, not at 9 (5678)
                column: curLoc.column - length + 1,
            },
            end: curLoc,
        })
        this.state = [GlobalStateType.OTHER, { state: nextState }]
    }
    public end() {
        if (this.state[0] !== GlobalStateType.OTHER || this.state[1].state !== OtherState.END || this.stack.length !== 0) {
            this.raiseError("Unexpected end, " + getStateDescription(this.state))
            return this
        }

        this.curChar = 0
        this.state = [GlobalStateType.OTHER, { state: OtherState.EXPECTING_ROOTVALUE }]
        this.closed = true
        this.onend.signal()
        this.onready.signal()
        //CParser.call(parser, parser.opt)
        return this
    }
    private initString(stringType: StringType, nextState: OtherState) {
        this.state = [GlobalStateType.STRING, {
            start: this.getLocation(),
            textNode: "",
            stringType: stringType,
            nextState: nextState,
            unicode: null,
            slashed: false
        }]
    }
    private pop(st: OtherStateData) {
        const popped = this.stack.pop()
        if (popped === undefined) {
            this.raiseError("unexpected end of stack")
        } else {
            this.currentContextType = popped
            switch (popped) {
                case ContextType.ARRAY:
                    st.state = OtherState.EXPECTING_COMMA_OR_ARRAY_END
                    break
                case ContextType.OBJECT:
                    st.state = OtherState.EXPECTING_COMMA_OR_OBJECT_END
                    break
                case ContextType.ROOT:
                    st.state = OtherState.END
                    break
            }
        }
    }
    private processKey(c: number) {
        if (c === StringChar.quotationMark) {
            this.initString(StringType.KEY, OtherState.EXPECTING_COLON)
        } else this.raiseError(`Malformed object, key should start with '"'`)
    }
    private processValue(c: number, nextState: OtherState) {
        if (c === StringChar.quotationMark) {
            this.initString(StringType.VALUE, nextState)
        }
        else if (c === Char.openBrace) {
            this.state = [GlobalStateType.OTHER, { state: OtherState.EXPECTING_KEY_OR_OBJECT_END }]
            this.onopenobject.signal(this.getLocation())
            this.stack.push(this.currentContextType)
            this.currentContextType = ContextType.OBJECT

        } else if (c === Char.openBracket) {
            this.state = [GlobalStateType.OTHER, { state: OtherState.EXPECTING_VALUE_OR_ARRAY_END }]
            this.onopenarray.signal(this.getLocation())

            this.stack.push(this.currentContextType)
            this.currentContextType = ContextType.ARRAY

        }
        else if (c === KeywordChar.t) this.state = [GlobalStateType.KEYWORD, { state: KeywordState.TRUE, nextState: nextState }]
        else if (c === KeywordChar.f) this.state = [GlobalStateType.KEYWORD, { state: KeywordState.FALSE, nextState: nextState }]
        else if (c === KeywordChar.n) this.state = [GlobalStateType.KEYWORD, { state: KeywordState.NULL, nextState: nextState }]
        else if (c === NumberChar.minus || NumberChar._0 <= c && c <= NumberChar._9) {
            this.state = [GlobalStateType.NUMBER, {
                start: this.getLocation(),
                numberNode: String.fromCharCode(c),
                nextState: nextState,
                foundExponent: false,
                foundPeriod: false,
            }]
        } else this.raiseError("Bad value")
    }
}
