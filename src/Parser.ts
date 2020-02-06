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

export type Allow = {
    trailing_commas?: boolean
    parens_instead_of_braces?: boolean
    angle_brackets_instead_of_brackets?: boolean
    comments?: boolean
    missing_commas?: boolean
    apostrophes_instead_of_quotation_marks?: boolean
}

export const lax: Allow = {
    comments: true,
    trailing_commas: true,
    parens_instead_of_braces: true,
    missing_commas: true,
    apostrophes_instead_of_quotation_marks: true,
}

export type Options = {
    spaces_per_tab?: number
    allow?: Allow
}

export enum GlobalStateType {
    ERROR,
    COMMENT,
    STRING,
    NUMBER,
    KEYWORD,
    ROOT,
    ARRAY,
    OBJECT,
}

enum RootState {
    EXPECTING_ROOTVALUE, // value at the root
    EXPECTING_END, // no more input expected
}

enum ObjectState {

    EXPECTING_OBJECTVALUE, // value in object
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

enum KeywordState {
    TRUE_EXPECTING_R, // r
    TRUE_EXPECTING_U, // u
    TRUE_EXPECTING_E, // e

    FALSE_EXPECTING_A, // a
    FALSE_EXPECTING_L, // l
    FALSE_EXPECTING_S, // s
    FALSE_EXPECTING_E, // e

    NULL_EXPECTING_U, // u
    NULL_EXPECTING_L1, // l
    NULL_EXPECTING_L2, // l
}

type GlobalState =
    | [GlobalStateType.ERROR, {
        error: Error
    }]
    | [GlobalStateType.NUMBER, {
        start: Location
        numberNode: string
        foundExponent: boolean
        foundPeriod: boolean
    }]
    | [GlobalStateType.KEYWORD, {
        state: KeywordState
    }]
    | [GlobalStateType.STRING, {
        startCharacter: number
        start: Location
        textNode: string
        stringType: StringType
        unicode: null | Unicode
        slashed: boolean // = false
    }]
    | [GlobalStateType.ROOT, { state: RootState }]
    | [GlobalStateType.OBJECT, { state: ObjectState, context: ObjectContext }]
    | [GlobalStateType.ARRAY, { state: ArrayState, context: ArrayContext }]

function getStateDescription(s: GlobalState): string {
    switch (s[0]) {
        case GlobalStateType.ERROR: return "ERROR"
        case GlobalStateType.NUMBER: return "NUMBER"
        case GlobalStateType.STRING: return "STRING"
        case GlobalStateType.KEYWORD: {
            switch (s[1].state) {
                case KeywordState.TRUE_EXPECTING_R: return "TRUE"
                case KeywordState.TRUE_EXPECTING_U: return "TRUE2"
                case KeywordState.TRUE_EXPECTING_E: return "TRUE3"
                case KeywordState.FALSE_EXPECTING_A: return "FALSE"
                case KeywordState.FALSE_EXPECTING_L: return "FALSE2"
                case KeywordState.FALSE_EXPECTING_S: return "FALSE3"
                case KeywordState.FALSE_EXPECTING_E: return "FALSE4"
                case KeywordState.NULL_EXPECTING_U: return "NULL"
                case KeywordState.NULL_EXPECTING_L1: return "NULL2"
                case KeywordState.NULL_EXPECTING_L2: return "NULL3"
                default: return assertUnreachable(s[1].state)
            }
        }
        case GlobalStateType.ROOT: {

            switch (s[1].state) {
                case RootState.EXPECTING_END: return "EXPECTING_END"
                case RootState.EXPECTING_ROOTVALUE: return "EXPECTING_ROOTVALUE"
                default: return assertUnreachable(s[1].state)
            }
        }
        case GlobalStateType.OBJECT: {

            switch (s[1].state) {
                case ObjectState.EXPECTING_OBJECTVALUE: return "EXPECTING_OBJECTVALUE"
                case ObjectState.EXPECTING_KEY_OR_OBJECT_END: return "EXPECTING_KEY_OR_OBJECT_END"
                case ObjectState.EXPECTING_COMMA_OR_OBJECT_END: return "EXPECTING_COMMA_OR_OBJECT_END"
                case ObjectState.EXPECTING_KEY: return "EXPECTING_KEY"
                case ObjectState.EXPECTING_COLON: return "EXPECTING_COLON"
                default: return assertUnreachable(s[1].state)
            }
        }
        case GlobalStateType.ARRAY: {

            switch (s[1].state) {
                case ArrayState.EXPECTING_ARRAYVALUE: return "EXPECTING_ARRAYVALUE"
                case ArrayState.EXPECTING_VALUE_OR_ARRAY_END: return "EXPECTING_VALUE_OR_ARRAY_END"
                case ArrayState.EXPECTING_COMMA_OR_ARRAY_END: return "EXPECTING_COMMA_OR_ARRAY_END"
                default: return assertUnreachable(s[1].state)

            }
        }
        default: return assertUnreachable(s[0])

    }
}

enum StringTypeEnum {
    KEY,
    VALUE,
}

type StringType =
    | [StringTypeEnum.KEY, { containingObject: ObjectContext }]
    | [StringTypeEnum.VALUE, {}]

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
    apostrophe: 0x27,     // '
    reverseSolidus: 0x5C,    // \
    solidus: 0x2F,           // /

    b: 0x62,                 // b
    f: 0x66,                 // f
    n: 0x6E,                 // n
    r: 0x72,                 // r
    t: 0x74,                 // t
    u: 0x75,                 // u
}

const ArrayChar = {
    comma: 0x2C,             // ,
    openBracket: 0x5B,       // [
    closeBracket: 0x5D,      // ]
    openAngleBracket: 0x3C,  // <
    closeAngleBracket: 0x3E  // >
}

const ObjectChar = {
    comma: 0x2C,             // ,
    colon: 0x3A,             // :
    openBrace: 0x7B,         // {
    closeBrace: 0x7D,        // }
    openParen: 0x28,         // )
    closeParen: 0x29,        // )
}

type ObjectContext = { openChar: number }
type ArrayContext = { openChar: number }

type Context =
    | [ContextType.ROOT]
    | [ContextType.OBJECT, ObjectContext]
    | [ContextType.ARRAY, ArrayContext]

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

enum ValueType {
    STRING,
    FALSE,
    TRUE,
    NULL,
    OBJECT,
    ARRAY,
    NUMBER,
}


export class Parser {

    private bufferCheckPosition = MAX_BUFFER_LENGTH
    private curChar = 0
    closed = false
    readonly opt: Options

    private readonly stack = new Array<Context>()
    // mostly just for error reporting
    public position = 0
    public column = 0
    public line = 1

    public state: GlobalState = [GlobalStateType.ROOT, {
        state: RootState.EXPECTING_ROOTVALUE
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

    private currentContext: Context = [ContextType.ROOT]

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

            if (DEBUG) {
                const stateInfo = (this.commentState !== null ? "*comment*" : getStateDescription(this.state))
                console.log(stateInfo.padEnd(30, " "), currentChunkIndex, curChar, String.fromCharCode(curChar), this.position, this.line, this.column)
            }
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
                                this.setStateAfterValue()
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
                                    else if (curChar === StringChar.apostrophe) { $.textNode += '\'' } //deviation from the JSON standard
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
                                    } else if (curChar === $.startCharacter) {
                                        /**
                                         * THE STRING IS FINISHED
                                         */

                                        flush()
                                        const locationInfo = {
                                            start: $.start,
                                            end: this.getLocation()
                                        }
                                        if ($.stringType[0] === StringTypeEnum.KEY) {
                                            this.onkey.signal($.textNode, locationInfo)
                                            this.setState([GlobalStateType.OBJECT, { state: ObjectState.EXPECTING_COLON, context: $.stringType[1].containingObject }])
                                        } else {
                                            this.onvalue.signal($.textNode, locationInfo)
                                            this.setStateAfterValue()
                                        }
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

                            case KeywordState.TRUE_EXPECTING_R:
                                if (curChar === KeywordChar.r) $.state = KeywordState.TRUE_EXPECTING_U
                                else {
                                    this.raiseError('Invalid true started with t' + curChar)
                                }
                                break
                            case KeywordState.TRUE_EXPECTING_U:
                                if (curChar === KeywordChar.u) $.state = KeywordState.TRUE_EXPECTING_E
                                else {
                                    this.raiseError('Invalid true started with tr' + curChar)
                                }
                                break

                            case KeywordState.TRUE_EXPECTING_E:
                                if (curChar === KeywordChar.e) {
                                    this.finishKeyword(true, "true".length)
                                } else {
                                    this.raiseError('Invalid true started with tru' + curChar)
                                }
                                break

                            case KeywordState.FALSE_EXPECTING_A:
                                if (curChar === KeywordChar.a) $.state = KeywordState.FALSE_EXPECTING_L
                                else {
                                    this.raiseError('Invalid false started with f' + curChar)
                                }
                                break

                            case KeywordState.FALSE_EXPECTING_L:
                                if (curChar === KeywordChar.l) $.state = KeywordState.FALSE_EXPECTING_S
                                else {
                                    this.raiseError('Invalid false started with fa' + curChar)
                                }
                                break

                            case KeywordState.FALSE_EXPECTING_S:
                                if (curChar === KeywordChar.s) $.state = KeywordState.FALSE_EXPECTING_E
                                else {
                                    this.raiseError('Invalid false started with fal' + curChar)
                                }
                                break

                            case KeywordState.FALSE_EXPECTING_E:
                                if (curChar === KeywordChar.e) {
                                    this.finishKeyword(false, "false".length)
                                } else {
                                    this.raiseError('Invalid false started with fals' + curChar)
                                }
                                break

                            case KeywordState.NULL_EXPECTING_U:
                                if (curChar === KeywordChar.u) $.state = KeywordState.NULL_EXPECTING_L1
                                else {
                                    this.raiseError('Invalid null started with n' + curChar)
                                }
                                break

                            case KeywordState.NULL_EXPECTING_L1:
                                if (curChar === KeywordChar.l) $.state = KeywordState.NULL_EXPECTING_L2
                                else {
                                    this.raiseError('Invalid null started with nu' + curChar)
                                }
                                break

                            case KeywordState.NULL_EXPECTING_L2:
                                if (curChar === KeywordChar.l) {
                                    this.finishKeyword(null, "null".length)
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
                    case GlobalStateType.ARRAY: {
                        const $ = state[1]
                        while (curChar === WhitespaceChar.carriageReturn || curChar === WhitespaceChar.lineFeed || curChar === WhitespaceChar.space || curChar === WhitespaceChar.tab) {
                            next()
                            if (isNaN(curChar)) {
                                return
                            }
                        }
                        if (curChar === CommentChar.solidus) {
                            if (this.opt.allow?.comments) {
                                this.commentState = CommentState.FOUND_SLASH
                            } else {
                                this.raiseError("comments are not allowed. You can allow comments by setting the option 'allow_comments'")
                            }
                        } else {
                            switch ($.state) {
                                case ArrayState.EXPECTING_VALUE_OR_ARRAY_END:
                                    if (curChar === ArrayChar.closeBracket) {
                                        this.closeArray(curChar, $.context)
                                    } else {
                                        this.processValue(curChar)
                                    }
                                    break
                                case ArrayState.EXPECTING_ARRAYVALUE:
                                    if (curChar === ArrayChar.closeBracket) {
                                        if (this.opt.allow?.trailing_commas) {
                                            this.closeArray(curChar, $.context)
                                        } else {
                                            this.raiseError("trailing commas are not allowed")
                                        }
                                    } else {
                                        this.processValue(curChar)
                                    }
                                    break
                                case ArrayState.EXPECTING_COMMA_OR_ARRAY_END:
                                    if (curChar === ArrayChar.comma) {
                                        $.state = ArrayState.EXPECTING_ARRAYVALUE
                                    } else if (curChar === ArrayChar.closeBracket || curChar === ArrayChar.closeAngleBracket) {
                                        this.closeArray(curChar, $.context)
                                    } else {
                                        const closeCharacters = this.opt.allow?.angle_brackets_instead_of_brackets ? "']' or '>'" : "']'"

                                        if (this.getValueType(curChar) !== null) {
                                            if (this.opt.allow?.missing_commas) {
                                                this.processValue(curChar)
                                            } else {
                                                this.raiseError(`Bad array, expected ',' or ${closeCharacters} (missing commas are not allowed)`)
                                            }
                                        } else {
                                            if (this.opt.allow?.missing_commas) {
                                                this.raiseError(`Bad array, expected ',' or ${closeCharacters} or a value`)
                                            } else {
                                                this.raiseError(`Bad array, expected ',' or '${closeCharacters}`)
                                            }
                                        }
                                    }
                                    break

                                default:
                                    return assertUnreachable($.state)
                            }
                        }
                        next()
                        break
                    }
                    case GlobalStateType.OBJECT: {
                        while (curChar === WhitespaceChar.carriageReturn || curChar === WhitespaceChar.lineFeed || curChar === WhitespaceChar.space || curChar === WhitespaceChar.tab) {
                            next()
                            if (isNaN(curChar)) {
                                return
                            }
                        }
                        if (curChar === CommentChar.solidus) {
                            if (this.opt.allow?.comments) {
                                this.commentState = CommentState.FOUND_SLASH
                            } else {
                                this.raiseError("comments are not allowed. You can allow comments by setting the option 'allow_comments'")
                            }
                        } else {
                            const $ = state[1]
                            switch ($.state) {
                                case ObjectState.EXPECTING_KEY:
                                    if (curChar === ObjectChar.closeBrace || curChar === ObjectChar.closeParen) {
                                        if (this.opt.allow?.trailing_commas) {
                                            this.closeObject(curChar, $.context)
                                        } else {
                                            this.raiseError("trailing commas are not allowed")
                                        }
                                    } else {
                                        this.processKey(curChar, $.context)
                                    }

                                    break
                                case ObjectState.EXPECTING_KEY_OR_OBJECT_END:
                                    if (curChar === ObjectChar.closeBrace || curChar === ObjectChar.closeParen) {
                                        this.closeObject(curChar, $.context)
                                    } else {
                                        this.processKey(curChar, $.context)
                                    }
                                    break
                                case ObjectState.EXPECTING_COLON:
                                    if (curChar === ObjectChar.colon) {
                                        $.state = ObjectState.EXPECTING_OBJECTVALUE
                                    } else {
                                        this.raiseError(`Expected colon, found ${String.fromCharCode(curChar)}`)
                                    }
                                    break
                                case ObjectState.EXPECTING_COMMA_OR_OBJECT_END:
                                    if (curChar === ObjectChar.closeBrace || curChar === ObjectChar.closeParen) {
                                        this.closeObject(curChar, $.context)
                                    } else if (curChar === ObjectChar.comma) {
                                        $.state = ObjectState.EXPECTING_KEY
                                    } else {
                                        const closeCharacters = this.opt.allow?.parens_instead_of_braces ? "'}' or ')'" : "'}'"
                                        if (this.getValueType(curChar) !== null) {
                                            if (this.opt.allow?.missing_commas) {
                                                this.processValue(curChar)
                                            } else {
                                                this.raiseError(`Bad object, expected ',' or ${closeCharacters} (missing commas are not allowed)`)
                                            }
                                        } else {
                                            if (this.opt.allow?.missing_commas) {
                                                this.raiseError(`Bad object, expected ',' or ${closeCharacters} or a value`)
                                            } else {
                                                this.raiseError(`Bad object, expected ',' or ${closeCharacters}`)
                                            }
                                        }
                                    }
                                    break
                                case ObjectState.EXPECTING_OBJECTVALUE:
                                    this.processValue(curChar)
                                    break


                                default:
                                    return assertUnreachable($.state)
                            }
                        }
                        next()
                        break
                    }
                    case GlobalStateType.ROOT: {
                        /**
                         * ROOT PROCESSING
                         */
                        while (curChar === WhitespaceChar.carriageReturn || curChar === WhitespaceChar.lineFeed || curChar === WhitespaceChar.space || curChar === WhitespaceChar.tab) {
                            next()
                            if (isNaN(curChar)) {
                                return
                            }
                        }
                        if (curChar === CommentChar.solidus) {
                            if (this.opt.allow?.comments) {
                                this.commentState = CommentState.FOUND_SLASH
                            } else {
                                this.raiseError("comments are not allowed. You can allow comments by setting the option 'allow_comments'")
                            }
                        } else {
                            const $ = state[1]
                            switch ($.state) {
                                case RootState.EXPECTING_ROOTVALUE:
                                    this.processValue(curChar)
                                    break
                                case RootState.EXPECTING_END: {
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


    private setStateAfterValue() {
        switch (this.currentContext[0]) {
            case ContextType.ARRAY:
                this.setState([GlobalStateType.ARRAY, { state: ArrayState.EXPECTING_COMMA_OR_ARRAY_END, context: this.currentContext[1] }])
                break
            case ContextType.OBJECT:
                this.setState([GlobalStateType.OBJECT, { state: ObjectState.EXPECTING_COMMA_OR_OBJECT_END, context: this.currentContext[1] }])
                break
            case ContextType.ROOT:
                this.setState([GlobalStateType.ROOT, { state: RootState.EXPECTING_END }])
                break
        }

    }
    private closeObject(curChar: number, context: ObjectContext) {
        if (context.openChar === ObjectChar.openParen && curChar !== ObjectChar.closeParen) {
            this.raiseError("must close object with ')'")
        } else if (context.openChar === ObjectChar.openBrace && curChar !== ObjectChar.closeBrace) {
            this.raiseError("must close object with '}'")
        } else {
            this.oncloseobject.signal(this.getLocation())
            this.pop()
        }
    }
    private closeArray(curChar: number, context: ArrayContext) {
        if (context.openChar === ArrayChar.openBracket && curChar !== ArrayChar.closeBracket) {
            this.raiseError("must close array with ']'")
        } else if (context.openChar === ArrayChar.openAngleBracket && curChar !== ArrayChar.closeAngleBracket) {
            this.raiseError("must close object with '>'")
        } else {
            this.onclosearray.signal(this.getLocation())
            this.pop()
        }
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
        this.setState([GlobalStateType.ERROR, { error: error }])
        if (DEBUG) { console.log("error raised:", er) }
        this.onerror.signal(error)
    }
    private finishKeyword(value: false | true | null, length: number) {
        const curLoc = this.getLocation()
        this.onvalue.signal(value, {
            start: {
                line: curLoc.line,
                position: curLoc.position - length + 1, //plus 1 because a string of say 4 characters starting at 5 and ends at 8, not at 9 (5678)
                column: curLoc.column - length + 1,
            },
            end: curLoc,
        })
        this.setStateAfterValue()
    }
    public end() {
        if (this.state[0] !== GlobalStateType.ROOT || this.state[1].state !== RootState.EXPECTING_END || this.stack.length !== 0) {
            this.raiseError("Unexpected end, " + getStateDescription(this.state))
            return this
        }

        this.curChar = 0
        this.setState([GlobalStateType.ROOT, { state: RootState.EXPECTING_ROOTVALUE }])
        this.closed = true
        this.onend.signal()
        this.onready.signal()
        //CParser.call(parser, parser.opt)
        return this
    }
    private setState(newState: GlobalState) {
        if (DEBUG) {
            console.log("setting state to", getStateDescription(newState))
        }
        this.state = newState
    }
    private initString(stringType: StringType, startCharacter: number) {
        if (startCharacter === StringChar.apostrophe && !this.opt.allow?.apostrophes_instead_of_quotation_marks) {
            this.raiseError(`Malformed string, should start with '"', apostrophes are not allowed`)
        } else {

            this.setState([GlobalStateType.STRING, {
                startCharacter: startCharacter,
                start: this.getLocation(),
                textNode: "",
                stringType: stringType,
                unicode: null,
                slashed: false
            }])
        }
    }
    private pop() {
        const popped = this.stack.pop()
        if (popped === undefined) {
            this.raiseError("unexpected end of stack")
        } else {
            this.currentContext = popped
            this.setStateAfterValue()
        }
    }
    private processKey(curChar: number, containingObject: ObjectContext) {
        if (curChar === StringChar.quotationMark || curChar === StringChar.apostrophe) {
            this.initString([StringTypeEnum.KEY, { containingObject: containingObject }], curChar)
        } else {
            this.raiseError(`Malformed object, key should start with '"' ${this.opt.allow?.apostrophes_instead_of_quotation_marks ? "or '''": ""}`)
        }
    }
    private processValue(curChar: number) {
        const vt = this.getValueType(curChar)
        if (vt === null) {
            this.raiseError("encountered a character that is not the start of a variable")
        } else {
            switch (vt) {
                case ValueType.ARRAY: {
                    if (curChar !== ArrayChar.openAngleBracket || this.opt.allow?.angle_brackets_instead_of_brackets) {
                        this.stack.push(this.currentContext)
                        const arrayContext = { openChar: curChar }
                        this.currentContext = [ContextType.ARRAY, arrayContext]
                        this.setState([GlobalStateType.ARRAY, { state: ArrayState.EXPECTING_VALUE_OR_ARRAY_END, context: arrayContext }])
                        this.onopenarray.signal(this.getLocation())
                    } else {
                        this.raiseError("angle brackets are not allowed")
                    }
                    break
                }
                case ValueType.FALSE: {
                    this.setState([GlobalStateType.KEYWORD, { state: KeywordState.FALSE_EXPECTING_A }])
                    break
                }
                case ValueType.NULL: {
                    this.setState([GlobalStateType.KEYWORD, { state: KeywordState.NULL_EXPECTING_U }])
                    break
                }
                case ValueType.NUMBER: {
                    this.setState([GlobalStateType.NUMBER, {
                        start: this.getLocation(),
                        numberNode: String.fromCharCode(curChar),
                        foundExponent: false,
                        foundPeriod: false,
                    }])
                    break
                }
                case ValueType.OBJECT: {
                    if (curChar !== ObjectChar.openParen || this.opt.allow?.parens_instead_of_braces) {
                        this.stack.push(this.currentContext)
                        const objectContext = { openChar: curChar }
                        this.currentContext = [ContextType.OBJECT, objectContext]
                        this.setState([GlobalStateType.OBJECT, { state: ObjectState.EXPECTING_KEY_OR_OBJECT_END, context: objectContext }])
                        this.onopenobject.signal(this.getLocation())
                    } else {
                        this.raiseError("parens are not allowed")
                    }
                    break
                }
                case ValueType.STRING: {
                    this.initString([StringTypeEnum.VALUE, {}], curChar)
                    break
                }
                case ValueType.TRUE: {
                    this.setState([GlobalStateType.KEYWORD, { state: KeywordState.TRUE_EXPECTING_R }])
                    break
                }
                default:
                    return assertUnreachable(vt)
            }
        }
    }
    private getValueType(c: number): ValueType | null {
        if (c === StringChar.quotationMark || c === StringChar.apostrophe) {
            return ValueType.STRING
        } else if (c === ObjectChar.openBrace || c === ObjectChar.openParen) {
            return ValueType.OBJECT
        } else if (c === ArrayChar.openBracket || c === ArrayChar.openAngleBracket) {
            return ValueType.ARRAY
        } else if (c === KeywordChar.t) {
            return ValueType.TRUE
        } else if (c === KeywordChar.f) {
            return ValueType.FALSE
        } else if (c === KeywordChar.n) {
            return ValueType.NULL
        } else if (c === NumberChar.minus || NumberChar._0 <= c && c <= NumberChar._9) {
            return ValueType.NUMBER
        } else {
            return null
        }
    }
}
