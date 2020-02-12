import * as s from "./subscription"
import * as Char from "./Characters"

import {
    ContextType,
    KeywordState,
    RootState,
    ObjectState,
    ArrayState,
    Context,
    CommentState,
    ValueType,
    ObjectContext,
    ArrayContext,
    TypedUnionState,
    OnStringFinished,
    StackContext,
    StackContextType,
} from "./parserStateTypes"
import { Location, Range, printLocation } from "./location"
import { Options, Allow } from "./configurationTypes"


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

function getContextDescription(s: StackContext) {
    switch (s[0]) {
        case StackContextType.ROOT: {

            switch (s[1].state) {
                case RootState.EXPECTING_END: return "EXPECTING_END"
                case RootState.EXPECTING_ROOTVALUE: return "EXPECTING_ROOTVALUE"
                case RootState.EXPECTING_HASH_OR_ROOTVALUE: return "EXPECTING_ROOTVALUE_OR_HASH"
                case RootState.EXPECTING_SCHEMA_START: return "EXPECTING_SCHEMA_START"
                case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: return "EXPECTING_SCHEMA_START_OR_ROOT_VALUE"
                case RootState.EXPECTING_SCHEMA: return "EXPECTING_SCHEMA"
                default: return assertUnreachable(s[1].state)
            }
        }
        case StackContextType.OBJECT: {

            switch (s[1].state) {
                case ObjectState.EXPECTING_OBJECTVALUE: return "EXPECTING_OBJECTVALUE"
                case ObjectState.EXPECTING_KEY_OR_OBJECT_END: return "EXPECTING_KEY_OR_OBJECT_END"
                case ObjectState.EXPECTING_COMMA_OR_OBJECT_END: return "EXPECTING_COMMA_OR_OBJECT_END"
                case ObjectState.EXPECTING_KEY: return "EXPECTING_KEY"
                case ObjectState.EXPECTING_COLON: return "EXPECTING_COLON"
                default: return assertUnreachable(s[1].state)
            }
        }
        case StackContextType.ARRAY: {

            switch (s[1].state) {
                case ArrayState.EXPECTING_ARRAYVALUE: return "EXPECTING_ARRAYVALUE"
                case ArrayState.EXPECTING_VALUE_OR_ARRAY_END: return "EXPECTING_VALUE_OR_ARRAY_END"
                case ArrayState.EXPECTING_COMMA_OR_ARRAY_END: return "EXPECTING_COMMA_OR_ARRAY_END"
                default: return assertUnreachable(s[1].state)

            }
        }
        case StackContextType.TYPED_UNION: {
            switch (s[1].state) {
                case TypedUnionState.EXPECTING_OPTION: return "EXPECTING_STRING"
                case TypedUnionState.EXPECTING_VALUE: return "EXPECTING_VALUE"
                default: return assertUnreachable(s[1].state)

            }
        }
        default:
            return assertUnreachable(s[0])
    }
}

function getStateDescription(s: Context): string {
    switch (s[0]) {
        case ContextType.COMMENT: return "COMMENT"
        case ContextType.KEYWORD: {
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
        case ContextType.NUMBER: return "NUMBER"
        case ContextType.STACK: return "STACK"
        case ContextType.STRING: return "STRING"
        default: return assertUnreachable(s[0])

    }
}


export const lax: Allow = {
    comments: true,
    trailing_commas: true,
    parens_instead_of_braces: true,
    missing_commas: true,
    apostrophes_instead_of_quotation_marks: true,
    angle_brackets_instead_of_brackets: true,
    typed_unions: true,
    schema_reference: true,
    compact: true,
}

export type Error = {
    message: string,
    location: Location,
    character: number,
}

function printError(error: Error) {
    return `${error.message} @ ${printLocation(error.location)} '${String.fromCharCode(error.character)}' (${error.character})`

}

export interface DataSubscriber {
    onopenarray(location: Location, openCharacter: string): void
    onclosearray(location: Location, closeCharacter: string): void

    onopentypedunion(location: Location): void
    onclosetypedunion(): void
    onoption(option: string, range: Range): void

    onopenobject(location: Location, openCharacter: string): void
    oncloseobject(location: Location, closeCharacter: string): void
    onkey(key: string, range: Range): void

    onsimplevalue(value: string | boolean | null | number, range: Range): void

    onblockcomment(comment: string, indent: string | null, range: Range): void
    onlinecomment(comment: string, range: Range): void
}

export interface HeaderSubscriber {
    onschemastart(location: Location): void
    onschemaend(): void
    oncompact(isCompact: boolean, location: Location): void
}

export class Parser {

    private bufferCheckPosition = MAX_BUFFER_LENGTH
    private curChar = 0
    ended = false
    readonly opt: Options

    private readonly stack = new Array<StackContext>()
    private currentContext: StackContext

    // mostly just for error reporting
    public position = 0
    public column = 0
    public line = 1

    public state: Context
    public error: Error | null = null

    /**
     * the indent property keeps track of the whitespace characters after a newline.
     * when a block comment is reported, this indent will be sent along so that the
     * leading whitespace of the full block can be stripped
     */
    private indent: string | null = null

    ondata = new s.Subscribers<DataSubscriber>()
    onheaderdata = new s.Subscribers<HeaderSubscriber>()

    onend = new s.NoArgumentSubscribers()
    onerror = new s.OneArgumentSubscribers<Error>()
    onready = new s.NoArgumentSubscribers()

    constructor(opt?: Options) {
        this.opt = opt || {}
        if (INFO) console.log('-- emit', "onready")
        this.onready.signal()
        if (this.opt.require_schema_reference) {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_SCHEMA_START }]
            this.state = [ContextType.STACK]
        } else if (this.opt.allow?.schema_reference) {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE }]
            this.state = [ContextType.STACK]
        } else {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_ROOTVALUE }]
            this.state = [ContextType.STACK]
        }
    }

    public write(chunk: string): Parser {
        if (this.error !== null) {
            throw new SyntaxError(printError(this.error))
        }
        if (this.ended) {
            this.raiseError("Cannot write after close. Assign an onready handler.")
            return this
        }
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
        this.processChunk(chunk)
        if (this.position >= this.bufferCheckPosition) {
            switch (this.state[0]) {
                case ContextType.NUMBER: {
                    const $ = this.state[1]
                    if ($.numberNode.length > maxAllowed) {
                        this.raiseError("Max number buffer length exceeded: " + $.numberNode.length)
                    } else {
                        this.bufferCheckPosition = this.position + MAX_BUFFER_LENGTH - $.numberNode.length

                    }
                    break
                }
                case ContextType.STRING: {
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
                const stateInfo = getStateDescription(this.state)
                let char = (curChar === Char.Whitespace.tab) ? "\\t" : String.fromCharCode(curChar)

                console.log(`${stateInfo.padEnd(35)}${JSON.stringify(char).padStart(4)} ${("(" + curChar + ")").padEnd(5)} ${this.line.toString().padStart(4)}:${this.column.toString().padEnd(3)}(${this.position})`, currentChunkIndex)
            }
            if (!isNaN(curChar)) {
                this.position++
                //set the position
                switch (curChar) {
                    case Char.Whitespace.lineFeed:
                        this.line++
                        this.column = 0
                        this.indent = ""
                        break
                    case Char.Whitespace.carriageReturn:
                        break
                    case Char.Whitespace.tab:
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
            if (this.error !== null) {
                return
            }
            if (isNaN(curChar)) {
                //end of chunk reached
                return
            }
            const state = this.state
            switch (state[0]) {
                case ContextType.COMMENT: {
                    /**
                     * COMMENT
                     */
                    const $ = state[1]

                    let snippetStart: null | number = null
                    function flush() {
                        if (snippetStart !== null) {
                            $.commentNode += chunk.substring(snippetStart, currentChunkIndex)
                        } else {
                        }
                        snippetStart = null
                    }

                    commentLoop: while (true) {
                        //if (DEBUG) console.log(currentChunkIndex, curChar, String.fromCharCode(curChar), 'string loop', $.slashed, $.textNode)

                        if (this.error !== null) {
                            return
                        }
                        if (isNaN(curChar)) {
                            //end of the chunk
                            //store it and wait for more input
                            flush()
                            return
                        }
                        switch ($.state) {
                            case CommentState.BLOCK_COMMENT:
                                if (snippetStart === null) {
                                    snippetStart = currentChunkIndex
                                }
                                if (curChar === Char.Comment.asterisk) {
                                    $.state = CommentState.FOUND_ASTERISK
                                }
                                break
                            case CommentState.LINE_COMMENT:
                                if (curChar === Char.Whitespace.lineFeed || curChar === Char.Whitespace.carriageReturn) {
                                    //end of line comment
                                    this.setState([ContextType.STACK])
                                    flush()
                                    this.ondata.signal(s => s.onlinecomment($.commentNode, { start: $.start, end: this.getLocation() }))
                                    next()
                                    break commentLoop
                                } else {
                                    if (snippetStart === null) {
                                        snippetStart = currentChunkIndex
                                    }
                                }
                                break
                            case CommentState.FOUND_ASTERISK:
                                if (curChar === Char.Comment.solidus) {
                                    //end of block comment
                                    this.setState([ContextType.STACK])
                                    flush()
                                    const comment = $.commentNode.substring(0, $.commentNode.length - 1) //strip the found asterisk '*'
                                    this.ondata.signal(s => s.onblockcomment(comment, this.indent, { start: $.start, end: this.getLocation() }))
                                    next()
                                    break commentLoop
                                } else {
                                    if (snippetStart === null) {
                                        snippetStart = currentChunkIndex
                                    }
                                }
                                break
                            case CommentState.FOUND_SOLIDUS:
                                if (curChar === Char.Comment.solidus) {
                                    if (this.opt.allow?.comments) {
                                        $.state = CommentState.LINE_COMMENT
                                    } else {
                                        this.raiseError("comments are not allowed. You can allow comments by setting the option 'allow_comments'")
                                    }
                                } else if (curChar === Char.Comment.asterisk) {
                                    if (this.opt.allow?.comments) {
                                        $.state = CommentState.BLOCK_COMMENT
                                    } else {
                                        this.raiseError("comments are not allowed. You can allow comments by setting the option 'allow_comments'")
                                    }
                                } else {
                                    this.raiseError("found dangling slash")
                                }
                                break
                            default: assertUnreachable($.state)
                        }
                        next()
                    }
                    break
                }
                case ContextType.KEYWORD: {
                    /**
                     * KEYWORD PROCESSING (null, true, false)
                     */
                    const $ = state[1]
                    switch ($.state) {

                        case KeywordState.TRUE_EXPECTING_R:
                            if (curChar === Char.Keyword.r) $.state = KeywordState.TRUE_EXPECTING_U
                            else {
                                this.raiseError('Invalid true started with t' + curChar)
                            }
                            break
                        case KeywordState.TRUE_EXPECTING_U:
                            if (curChar === Char.Keyword.u) $.state = KeywordState.TRUE_EXPECTING_E
                            else {
                                this.raiseError('Invalid true started with tr' + curChar)
                            }
                            break

                        case KeywordState.TRUE_EXPECTING_E:
                            if (curChar === Char.Keyword.e) {
                                this.finishKeyword(true, "true".length)
                            } else {
                                this.raiseError('Invalid true started with tru' + curChar)
                            }
                            break

                        case KeywordState.FALSE_EXPECTING_A:
                            if (curChar === Char.Keyword.a) $.state = KeywordState.FALSE_EXPECTING_L
                            else {
                                this.raiseError('Invalid false started with f' + curChar)
                            }
                            break

                        case KeywordState.FALSE_EXPECTING_L:
                            if (curChar === Char.Keyword.l) $.state = KeywordState.FALSE_EXPECTING_S
                            else {
                                this.raiseError('Invalid false started with fa' + curChar)
                            }
                            break

                        case KeywordState.FALSE_EXPECTING_S:
                            if (curChar === Char.Keyword.s) $.state = KeywordState.FALSE_EXPECTING_E
                            else {
                                this.raiseError('Invalid false started with fal' + curChar)
                            }
                            break

                        case KeywordState.FALSE_EXPECTING_E:
                            if (curChar === Char.Keyword.e) {
                                this.finishKeyword(false, "false".length)
                            } else {
                                this.raiseError('Invalid false started with fals' + curChar)
                            }
                            break

                        case KeywordState.NULL_EXPECTING_U:
                            if (curChar === Char.Keyword.u) $.state = KeywordState.NULL_EXPECTING_L1
                            else {
                                this.raiseError('Invalid null started with n' + curChar)
                            }
                            break

                        case KeywordState.NULL_EXPECTING_L1:
                            if (curChar === Char.Keyword.l) $.state = KeywordState.NULL_EXPECTING_L2
                            else {
                                this.raiseError('Invalid null started with nu' + curChar)
                            }
                            break

                        case KeywordState.NULL_EXPECTING_L2:
                            if (curChar === Char.Keyword.l) {
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
                case ContextType.NUMBER: {
                    /**
                     * NUMBER PROCESSING
                     */
                    const $ = state[1]
                    while (true) {
                        if (this.error !== null) {
                            return
                        }
                        if (isNaN(curChar)) {
                            return
                        }
                        //if (DEBUG) console.log(currentChunkIndex, curChar, String.fromCharCode(curChar), 'number loop')

                        //first check if we are breaking out of a number. Can only be done by checking the character that comes directly after the number
                        if (curChar !== Char.Number.period
                            && curChar !== Char.Number.e
                            && curChar !== Char.Number.E
                            && curChar !== Char.Number.plus
                            && curChar !== Char.Number.minus
                            && !(Char.Number._0 <= curChar && curChar <= Char.Number._9)
                        ) {
                            this.wrapUpNumber()
                            //this character does not belong to the number so don't go to the next character
                            break
                        } else {
                            if ($.numberNode === "-0" || $.numberNode === "0") {
                                if (curChar !== Char.Number.period
                                    && curChar !== Char.Number.e
                                    && curChar !== Char.Number.E
                                ) {
                                    this.raiseError(`Leading zero not followed by '.', 'e', 'E', ',' ']', '}' or whitespace`)
                                }
                            }
                            if (curChar === Char.Number.period) {
                                if ($.foundPeriod) {
                                    this.raiseError('Invalid number, has two dots')
                                }
                                $.foundPeriod = true
                            } else if (curChar === Char.Number.e || curChar === Char.Number.E) {
                                if ($.foundExponent) {
                                    this.raiseError('Invalid number, has two exponential')
                                }
                                $.foundExponent = true
                            } else if (curChar === Char.Number.plus || curChar === Char.Number.minus) {
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
                case ContextType.STACK: {
                    const $ = this.currentContext
                    switch ($[0]) {
                        /**
                         * ARRAY
                         */
                        case StackContextType.ARRAY: {
                            const $$ = $[1]
                            while (isWhiteSpace(curChar)) {
                                next()
                                if (isNaN(curChar)) {
                                    return
                                }
                            }
                            this.indent = null
                            if (curChar === Char.Comment.solidus) {
                                this.onFoundSolidus()
                            } else {
                                switch ($$.state) {
                                    case ArrayState.EXPECTING_VALUE_OR_ARRAY_END:
                                        if (curChar === Char.Array.closeBracket) {
                                            this.closeArray(curChar, $$)
                                        } else {
                                            const vt = this.getValueType(curChar)
                                            if (vt !== null) {
                                                $$.state = ArrayState.EXPECTING_COMMA_OR_ARRAY_END
                                                this.processValue(vt, curChar)
                                            } else {
                                                this.raiseError("expected value or array end")
                                            }
                                        }
                                        break
                                    case ArrayState.EXPECTING_ARRAYVALUE:
                                        if (curChar === Char.Array.closeBracket) {
                                            if (this.opt.allow?.trailing_commas) {
                                                this.closeArray(curChar, $$)
                                            } else {
                                                this.raiseError("trailing commas are not allowed")
                                            }
                                        } else {

                                            const vt = this.getValueType(curChar)
                                            if (vt === null) {
                                                this.raiseError("expected a value after a comma")
                                            } else {
                                                $$.state = ArrayState.EXPECTING_COMMA_OR_ARRAY_END
                                                this.processValue(vt, curChar)
                                            }
                                        }
                                        break
                                    case ArrayState.EXPECTING_COMMA_OR_ARRAY_END:
                                        if (curChar === Char.Array.comma) {
                                            $$.state = ArrayState.EXPECTING_ARRAYVALUE
                                        } else if (curChar === Char.Array.closeBracket || curChar === Char.Array.closeAngleBracket) {
                                            this.closeArray(curChar, $$)
                                        } else {
                                            const closeCharacters = this.opt.allow?.angle_brackets_instead_of_brackets ? "']' or '>'" : "']'"
                                            const vt = this.getValueType(curChar)
                                            if (vt !== null) {
                                                if (this.opt.allow?.missing_commas) {
                                                    $$.state = ArrayState.EXPECTING_COMMA_OR_ARRAY_END
                                                    this.processValue(vt, curChar)
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
                                        return assertUnreachable($$.state)
                                }
                            }
                            next()
                            break
                        }
                        case StackContextType.OBJECT: {
                            const $$ = $[1]

                            while (isWhiteSpace(curChar)) {
                                next()
                                if (isNaN(curChar)) {
                                    return
                                }
                            }
                            this.indent = null

                            if (curChar === Char.Comment.solidus) {
                                this.onFoundSolidus()
                            } else {
                                switch ($$.state) {
                                    case ObjectState.EXPECTING_KEY:
                                        if (curChar === Char.Object.closeBrace || curChar === Char.Object.closeParen) {
                                            if (this.opt.allow?.trailing_commas) {
                                                this.closeObject(curChar, $$)
                                            } else {
                                                this.raiseError("trailing commas are not allowed")
                                            }
                                        } else {
                                            this.processKey(curChar, $$)
                                        }

                                        break
                                    case ObjectState.EXPECTING_KEY_OR_OBJECT_END:
                                        if (curChar === Char.Object.closeBrace || curChar === Char.Object.closeParen) {
                                            this.closeObject(curChar, $$)
                                        } else {
                                            this.processKey(curChar, $$)
                                        }
                                        break
                                    case ObjectState.EXPECTING_COLON:
                                        if (curChar === Char.Object.colon) {
                                            $$.state = ObjectState.EXPECTING_OBJECTVALUE
                                        } else {
                                            this.raiseError(`Expected colon, found ${String.fromCharCode(curChar)}`)
                                        }
                                        break
                                    case ObjectState.EXPECTING_COMMA_OR_OBJECT_END:
                                        if (curChar === Char.Object.closeBrace || curChar === Char.Object.closeParen) {
                                            this.closeObject(curChar, $$)
                                        } else if (curChar === Char.Object.comma) {
                                            $$.state = ObjectState.EXPECTING_KEY
                                        } else if (curChar === Char.String.quotationMark || curChar === Char.String.apostrophe) {
                                            if (this.opt.allow?.missing_commas) {
                                                this.processKey(curChar, $$)
                                            } else {
                                                this.raiseError(`Bad object, missing comma`)
                                            }
                                        } else {
                                            const closeCharacters = this.opt.allow?.parens_instead_of_braces ? "'}' or ')'" : "'}'"
                                            if (this.opt.allow?.missing_commas) {
                                                this.raiseError(`Bad object, expected ',' or ${closeCharacters} or a value`)
                                            } else {
                                                this.raiseError(`Bad object, expected ',' or ${closeCharacters}`)
                                            }
                                        }
                                        break
                                    case ObjectState.EXPECTING_OBJECTVALUE:
                                        const vt = this.getValueType(curChar)
                                        if (vt === null) {
                                            this.raiseError("expected a value after a ':'")
                                        } else {
                                            $$.state = ObjectState.EXPECTING_COMMA_OR_OBJECT_END
                                            this.processValue(vt, curChar)
                                        }
                                        break
                                    default:
                                        return assertUnreachable($$.state)
                                }
                            }
                            next()
                            break
                        }
                        case StackContextType.ROOT: {
                            /**
                             * ROOT PROCESSING
                             */
                            const $$ = $[1]

                            while (isWhiteSpace(curChar)) {
                                next()
                                if (isNaN(curChar)) {
                                    return
                                }
                            }
                            this.indent = null

                            if (curChar === Char.Comment.solidus) {
                                this.onFoundSolidus()
                            } else {
                                switch ($$.state) {
                                    case RootState.EXPECTING_END: {
                                        this.raiseError(`Unexpected data after end`)
                                        break
                                    }
                                    case RootState.EXPECTING_HASH_OR_ROOTVALUE: {
                                        this.onheaderdata.signal(s => s.onschemaend())
                                        if (curChar === Char.Header.hash) {

                                            if (!this.opt.allow?.compact) {
                                                this.raiseError("compact not allowed")
                                            } else {
                                                this.onheaderdata.signal(s => s.oncompact(true, this.getLocation()))
                                                $$.state = RootState.EXPECTING_ROOTVALUE
                                            }
                                        } else {
                                            this.onheaderdata.signal(s => s.oncompact(false, this.getLocation()))
                                            const vt = this.getValueType(curChar)
                                            if (vt === null) {
                                                this.raiseError("expected a hash ('#') or the root value")
                                            } else {
                                                $$.state = RootState.EXPECTING_END

                                                this.processValue(vt, curChar)
                                            }
                                        }
                                        break
                                    }
                                    case RootState.EXPECTING_SCHEMA: {
                                        const vt = this.getValueType(curChar)
                                        if (vt === null) {
                                            this.raiseError("expected the schema")
                                        } else {
                                            $$.state = RootState.EXPECTING_HASH_OR_ROOTVALUE
                                            this.processValue(vt, curChar)
                                        }
                                        break
                                    }
                                    case RootState.EXPECTING_ROOTVALUE: {
                                        const vt = this.getValueType(curChar)
                                        if (vt === null) {
                                            this.raiseError("expected the root value")
                                        } else {
                                            $$.state = RootState.EXPECTING_END
                                            this.processValue(vt, curChar)
                                        }
                                        break
                                    }
                                    case RootState.EXPECTING_SCHEMA_START:
                                        if (curChar !== Char.Header.exclamationMark) {
                                            this.raiseError("expected schema start (!)")
                                        } else {
                                            this.onheaderdata.signal(s => s.onschemastart(this.getLocation()))
                                            $$.state = RootState.EXPECTING_SCHEMA
                                        }
                                        break
                                    case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                                        if (curChar === Char.Header.exclamationMark) {
                                            $$.state = RootState.EXPECTING_SCHEMA
                                            this.onheaderdata.signal(s => s.onschemastart(this.getLocation()))

                                        } else {
                                            const vt = this.getValueType(curChar)
                                            if (vt === null) {
                                                this.raiseError("expected an '!' (to specify a schema reference) or a value")
                                            } else {
                                                $$.state = RootState.EXPECTING_END
                                                this.processValue(vt, curChar)
                                            }
                                        }
                                        break
                                    default:
                                        return assertUnreachable($$.state)
                                }
                            }
                            next()
                            break
                        }
                        case StackContextType.TYPED_UNION: {
                            const $$ = $[1]

                            while (isWhiteSpace(curChar)) {
                                next()
                                if (isNaN(curChar)) {
                                    return
                                }
                            }
                            this.indent = null

                            if (curChar === Char.Comment.solidus) {
                                this.onFoundSolidus()
                            } else {
                                switch ($$.state) {
                                    case TypedUnionState.EXPECTING_OPTION:
                                        if (this.isStringStart(curChar)) {
                                            this.initString(curChar, (textNode, range) => {
                                                this.ondata.signal(s => s.onoption(textNode, range))
                                                $$.state = TypedUnionState.EXPECTING_VALUE
                                            })
                                        } else {
                                            this.raiseError("missing typed union string")
                                        }
                                        break
                                    case TypedUnionState.EXPECTING_VALUE: {
                                        const vt = this.getValueType(curChar)
                                        if (vt === null) {
                                            this.raiseError("expected the data of the union type")
                                        } else {
                                            this.processValue(vt, curChar)
                                        }
                                        break
                                    }
                                    default:
                                        return assertUnreachable($$.state)
                                }
                            }

                            next()
                            break
                        }

                        default:
                            return assertUnreachable($[0])
                    }
                    break
                }
                case ContextType.STRING: {
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
                        if (this.error !== null) {
                            return
                        }
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
                                if (curChar === Char.String.quotationMark) { $.textNode += '\"' }
                                else if (curChar === Char.String.apostrophe) { $.textNode += '\'' } //deviation from the JSON standard
                                else if (curChar === Char.String.reverseSolidus) { $.textNode += '\\' }
                                else if (curChar === Char.String.solidus) { $.textNode += '\/' }
                                else if (curChar === Char.String.b) { $.textNode += '\b' }
                                else if (curChar === Char.String.f) { $.textNode += '\f' }
                                else if (curChar === Char.String.n) { $.textNode += '\n' }
                                else if (curChar === Char.String.r) { $.textNode += '\r' }
                                else if (curChar === Char.String.t) { $.textNode += '\t' }
                                else if (curChar === Char.String.u) {
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
                                if (curChar === Char.String.reverseSolidus) {//backslash
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
                                    this.setState([ContextType.STACK])
                                    $.onFinished($.textNode, locationInfo)
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
                default: assertUnreachable(state[0])
            }
        }
    }
    // public resume() {
    //     this.error = null
    //     return this
    // }
    public close() {
        if (this.error !== null) {
            throw new SyntaxError(printError(this.error))
        }
        if (this.ended) {
            this.raiseError("Already closed.")
        }
        return this.end()
    }

    private wrapUpNumber() {
        if (this.state[0] === ContextType.NUMBER) {
            //cleanup of number (we can only detect the end of a number at the first non number character or at the end)
            const numberState = this.state[1]
            this.ondata.signal(s => s.onsimplevalue(new Number(numberState.numberNode).valueOf(), {
                start: numberState.start,
                end: {
                    line: this.line,
                    position: this.position - 1,
                    column: this.column - 1
                }
            }))
            this.setStateAfterValue()
        }
    }
    private closeObject(curChar: number, context: ObjectContext) {
        if (context.openChar === Char.Object.openParen && curChar !== Char.Object.closeParen) {
            this.raiseError("must close object with ')'")
        } else if (context.openChar === Char.Object.openBrace && curChar !== Char.Object.closeBrace) {
            this.raiseError("must close object with '}'")
        } else {
            this.ondata.signal(s => s.oncloseobject(this.getLocation(), String.fromCharCode(curChar)))
            this.popContext()
        }
    }
    private closeArray(curChar: number, context: ArrayContext) {
        if (context.openChar === Char.Array.openBracket && curChar !== Char.Array.closeBracket) {
            this.raiseError("must close array with ']'")
        } else if (context.openChar === Char.Array.openAngleBracket && curChar !== Char.Array.closeAngleBracket) {
            this.raiseError("must close object with '>'")
        } else {
            this.ondata.signal(s => s.onclosearray(this.getLocation(), String.fromCharCode(curChar)))
            this.popContext()
        }
    }

    private getLocation(): Location {
        return {
            position: this.position,
            line: this.line,
            column: this.column,
        }
    }

    private raiseError(message: string) {
        const error = {
            message: message,
            location: this.getLocation(),
            character: this.curChar
        }
        this.error = error
        if (DEBUG) { console.log("error raised:", printError(error)) }
        this.onerror.signal(error)
    }
    private finishKeyword(value: false | true | null, length: number) {
        const curLoc = this.getLocation()
        this.ondata.signal(s => s.onsimplevalue(value, {
            start: {
                line: curLoc.line,
                position: curLoc.position - length + 1, //plus 1 because a string of say 4 characters starting at 5 and ends at 8, not at 9 (5678)
                column: curLoc.column - length + 1,
            },
            end: curLoc,
        }))
        this.setStateAfterValue()
    }
    public end() {
        this.wrapUpNumber()

        if (this.error !== null) {
            return
        }
        const state = this.state
        if (state[0] !== ContextType.STACK || this.currentContext[0] !== StackContextType.ROOT || this.currentContext[1].state !== RootState.EXPECTING_END || this.stack.length !== 0) {
            this.raiseError("unexpected end, " + getStateDescription(this.state))
            return
        }

        this.ended = true
        this.onend.signal()
        this.onready.signal()
    }
    private onFoundSolidus() {
        this.wrapUpNumber()
        this.setState([ContextType.COMMENT, {
            state: CommentState.FOUND_SOLIDUS,
            commentNode: "",
            start: this.getLocation()
        }])
    }
    private setState(newState: Context) {
        if (DEBUG) {
            console.log("setting state to", getStateDescription(newState))
        }
        this.state = newState
    }
    private isStringStart(curChar: number) {
        return curChar === Char.String.quotationMark || curChar === Char.String.apostrophe
    }
    private initString(startCharacter: number, onFinished: OnStringFinished) {
        if (startCharacter === Char.String.apostrophe && !this.opt.allow?.apostrophes_instead_of_quotation_marks) {
            this.raiseError(`Malformed string, should start with '"', apostrophes are not allowed`)
        } else {
            this.setState([ContextType.STRING, {
                startCharacter: startCharacter,
                start: this.getLocation(),
                textNode: "",
                onFinished: onFinished,
                unicode: null,
                slashed: false
            }])
        }
    }
    private pushContext(context: StackContext) {
        this.stack.push(this.currentContext)
        if (DEBUG) console.log(`pushed context ${getContextDescription(this.currentContext)}>${getContextDescription(context)}`)
        this.currentContext = context
        this.setState([ContextType.STACK])
    }
    private popContext() {
        const popped = this.stack.pop()
        if (popped === undefined) {
            throw new Error("unexpected end of stack")
        } else {
            if (DEBUG) console.log(`popped context ${getContextDescription(popped)}<${getContextDescription(this.currentContext)}`)
            this.currentContext = popped
            this.setStateAfterValue()
        }
    }
    private setStateAfterValue() {
        this.setState([ContextType.STACK])
        const currentContext = this.currentContext
        switch (currentContext[0]) {
            case StackContextType.ARRAY:
                break
            case StackContextType.OBJECT:
                break
            case StackContextType.ROOT:
                break
            case StackContextType.TYPED_UNION:
                this.ondata.signal(s => s.onclosetypedunion())
                this.popContext()
                break
            default:
                assertUnreachable(currentContext[0])
        }

    }
    private processKey(curChar: number, containingObject: ObjectContext) {
        if (curChar === Char.String.quotationMark || curChar === Char.String.apostrophe) {
            this.initString(curChar, (textNode, range) => {
                this.ondata.signal(s => s.onkey(textNode, range))
                containingObject.state = ObjectState.EXPECTING_COLON
            })
        } else {
            this.raiseError(`Malformed object, key should start with '"' ${this.opt.allow?.apostrophes_instead_of_quotation_marks ? "or '''" : ""}`)
        }
    }
    private processValue(vt: ValueType, curChar: number) {
        switch (vt) {
            case ValueType.ARRAY: {
                if (curChar === Char.Array.openAngleBracket && !this.opt.allow?.angle_brackets_instead_of_brackets) {
                    this.raiseError("angle brackets are not allowed")
                } else {
                    this.ondata.signal(s => s.onopenarray(this.getLocation(), String.fromCharCode(curChar)))
                    this.pushContext([StackContextType.ARRAY, { openChar: curChar, state: ArrayState.EXPECTING_VALUE_OR_ARRAY_END }])
                }
                break
            }
            case ValueType.FALSE: {
                this.setState([ContextType.KEYWORD, { state: KeywordState.FALSE_EXPECTING_A }])
                break
            }
            case ValueType.NULL: {
                this.setState([ContextType.KEYWORD, { state: KeywordState.NULL_EXPECTING_U }])
                break
            }
            case ValueType.NUMBER: {
                this.setState([ContextType.NUMBER, {
                    start: this.getLocation(),
                    numberNode: String.fromCharCode(curChar),
                    foundExponent: false,
                    foundPeriod: false,
                }])
                break
            }
            case ValueType.OBJECT: {
                if (curChar === Char.Object.openParen && !this.opt.allow?.parens_instead_of_braces) {
                    this.raiseError("parens are not allowed")
                } else {
                    this.ondata.signal(s => s.onopenobject(this.getLocation(), String.fromCharCode(curChar)))
                    this.pushContext([StackContextType.OBJECT, { state: ObjectState.EXPECTING_KEY_OR_OBJECT_END, openChar: curChar }])
                }
                break
            }
            case ValueType.STRING: {
                this.initString(curChar, (textNode, range) => {
                    this.ondata.signal(s => s.onsimplevalue(textNode, range))
                    this.setStateAfterValue()
                })
                break
            }
            case ValueType.TRUE: {
                this.setState([ContextType.KEYWORD, { state: KeywordState.TRUE_EXPECTING_R }])
                break
            }
            case ValueType.TYPED_UNION: {
                if (this.opt.allow?.typed_unions) {
                    this.pushContext([StackContextType.TYPED_UNION, { state: TypedUnionState.EXPECTING_OPTION }])
                    this.ondata.signal(s => s.onopentypedunion(this.getLocation()))
                } else {
                    this.raiseError("typed unions are not allowed")
                }
                break
            }
            default:
                return assertUnreachable(vt)
        }
    }
    private getValueType(curChar: number): ValueType | null {
        if (curChar === Char.String.quotationMark || curChar === Char.String.apostrophe) {
            return ValueType.STRING
        } else if (curChar === Char.Object.openBrace || curChar === Char.Object.openParen) {
            return ValueType.OBJECT
        } else if (curChar === Char.Array.openBracket || curChar === Char.Array.openAngleBracket) {
            return ValueType.ARRAY
        } else if (curChar === Char.TypedUnion.verticalLine) { //extension to strict JSON specifications
            return ValueType.TYPED_UNION
        } else if (curChar === Char.Number.minus || Char.Number._0 <= curChar && curChar <= Char.Number._9) {
            return ValueType.NUMBER
        } else if (curChar === Char.Keyword.t) {
            return ValueType.TRUE
        } else if (curChar === Char.Keyword.f) {
            return ValueType.FALSE
        } else if (curChar === Char.Keyword.n) {
            return ValueType.NULL
        } else {
            return null
        }
    }
}

function isWhiteSpace(curChar: number) {
    return curChar === Char.Whitespace.carriageReturn || curChar === Char.Whitespace.lineFeed || curChar === Char.Whitespace.space || curChar === Char.Whitespace.tab
}