/* eslint
    @typescript-eslint/camelcase: "off",
    camelcase:"off",
    complexity:"off",
    no-console:"off",
*/

import * as subscr from "./subscription"
import * as Char from "./Characters"

import {
    ContextType,
    RootState,
    ObjectState,
    ArrayState,
    Context,
    CommentState,
    ValueType,
    ObjectContext,
    ArrayContext,
    TaggedUnionState,
    OnStringFinished,
    StackContext,
    StackContextType,
} from "./parserStateTypes"
import { Location, Range, printLocation } from "./location"
import { Options, Allow } from "./configurationTypes"

export function parser(opt?: Options) { return new Parser(opt) }
export const DEBUG = false
export const INFO = false


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

function getContextDescription(stackContext: StackContext) {
    switch (stackContext[0]) {
        case StackContextType.ROOT: {
            switch (stackContext[1].state) {
                case RootState.EXPECTING_END: return "EXPECTING_END"
                case RootState.EXPECTING_ROOTVALUE: return "EXPECTING_ROOTVALUE"
                case RootState.EXPECTING_HASH_OR_ROOTVALUE: return "EXPECTING_ROOTVALUE_OR_HASH"
                case RootState.EXPECTING_SCHEMA_START: return "EXPECTING_SCHEMA_START"
                case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: return "EXPECTING_SCHEMA_START_OR_ROOT_VALUE"
                case RootState.EXPECTING_SCHEMA: return "EXPECTING_SCHEMA"
                default: return assertUnreachable(stackContext[1].state)
            }
        }
        case StackContextType.OBJECT: {
            switch (stackContext[1].state) {
                case ObjectState.EXPECTING_OBJECTVALUE: return "EXPECTING_OBJECTVALUE"
                case ObjectState.EXPECTING_KEY_OR_OBJECT_END: return "EXPECTING_KEY_OR_OBJECT_END"
                case ObjectState.EXPECTING_COMMA_OR_OBJECT_END: return "EXPECTING_COMMA_OR_OBJECT_END"
                case ObjectState.EXPECTING_KEY: return "EXPECTING_KEY"
                case ObjectState.EXPECTING_COLON: return "EXPECTING_COLON"
                default: return assertUnreachable(stackContext[1].state)
            }
        }
        case StackContextType.ARRAY: {
            switch (stackContext[1].state) {
                case ArrayState.EXPECTING_ARRAYVALUE: return "EXPECTING_ARRAYVALUE"
                case ArrayState.EXPECTING_VALUE_OR_ARRAY_END: return "EXPECTING_VALUE_OR_ARRAY_END"
                case ArrayState.EXPECTING_COMMA_OR_ARRAY_END: return "EXPECTING_COMMA_OR_ARRAY_END"
                default: return assertUnreachable(stackContext[1].state)
            }
        }
        case StackContextType.TAGGED_UNION: {
            switch (stackContext[1].state) {
                case TaggedUnionState.EXPECTING_OPTION: return "EXPECTING_STRING"
                case TaggedUnionState.EXPECTING_VALUE: return "EXPECTING_VALUE"
                default: return assertUnreachable(stackContext[1].state)
            }
        }
        default:
            return assertUnreachable(stackContext[0])
    }
}

function getStateDescription(stackContext: Context): string {
    switch (stackContext[0]) {
        case ContextType.COMMENT: return "COMMENT"
        case ContextType.UNQUOTED_STRING: return "UNQUOTED_STRING"
        case ContextType.STACK: return "STACK"
        case ContextType.QUOTED_STRING: return "QUOTED_STRING"
        default: return assertUnreachable(stackContext[0])

    }
}


export const lax: Allow = {
    comments: true,
    trailing_commas: true,
    parens_instead_of_braces: true,
    missing_commas: true,
    apostrophes_instead_of_quotation_marks: true,
    angle_brackets_instead_of_brackets: true,
    tagged_unions: true,
    schema: true,
    compact: true,
}

export type Error = {
    message: string
    location: Location
    character: number
}

function printError(error: Error) {
    return `${error.message} @ ${printLocation(error.location)} '${String.fromCharCode(error.character)}' (${error.character})`

}

export interface DataSubscriber {
    onopenarray(range: Range, openCharacter: string): void
    onclosearray(range: Range, closeCharacter: string): void

    onopentaggedunion(range: Range): void
    onclosetaggedunion(): void
    onoption(option: string, range: Range): void

    onopenobject(range: Range, openCharacter: string): void
    oncloseobject(range: Range, closeCharacter: string): void
    onkey(key: string, range: Range): void

    onquotedstring(value: string, quote: string, range: Range): void
    onunquotedstring(value: string, range: Range): void

    onblockcomment(comment: string, range: Range, indent: string | null): void
    onlinecomment(comment: string, range: Range): void
    onend(): void
}

export type DataSubscription = subscr.Subscribers<DataSubscriber>

export interface HeaderSubscriber {
    onschemastart(range: Range): void
    onschemaend(): void
    oncompact(isCompact: boolean, range: Range): void
}

export class Parser {
    private curChar = 0
    private ended = false
    private readonly opt: Options

    private readonly stack = new Array<StackContext>()
    private currentContext: StackContext

    // mostly just for error reporting
    private position = 0
    private column = 0
    private line = 1

    private state: Context
    private error: Error | null = null

    /**
     * the indent property keeps track of the whitespace characters after a newline.
     * when a block comment is reported, this indent will be sent along so that the
     * leading whitespace of the full block can be stripped
     */
    private indent: string | null = null

    readonly onschemadata = new subscr.Subscribers<DataSubscriber>()
    readonly ondata = new subscr.Subscribers<DataSubscriber>()
    private oncurrentdata: subscr.Subscribers<DataSubscriber>
    readonly onheaderdata = new subscr.Subscribers<HeaderSubscriber>()

    readonly onerror = new subscr.OneArgumentSubscribers<Error>()
    readonly onready = new subscr.NoArgumentSubscribers()

    constructor(opt?: Options) {
        this.opt = opt || {}
        if (INFO) console.log('-- emit', "onready")
        this.onready.signal()
        if (this.opt.require?.schema) {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_SCHEMA_START }]
            this.state = [ContextType.STACK]
        } else if (this.opt.allow?.schema) {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE }]
            this.state = [ContextType.STACK]
        } else {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_ROOTVALUE }]
            this.state = [ContextType.STACK]
        }
        this.oncurrentdata = this.ondata
    }

    public write(chunk: string) {
        if (this.error !== null) {
            throw new SyntaxError(printError(this.error))
        }
        if (this.ended) {
            this.raiseError("Cannot write after close. Assign an onready handler.")
        }
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
        this.processChunk(chunk)
    }

    public isInErrorState() {
        return this.error !== null
    }

    private processChunk(chunk: string): void {
        //initialize

        //start at the position just before the first character
        //because we are going to call next() once at the beginning
        let currentChunkIndex = -1
        let curChar = 0


        const next = () => {

            currentChunkIndex++

            curChar = chunk.charCodeAt(currentChunkIndex)
            this.curChar = curChar

            if (DEBUG) {
                const stateInfo = getStateDescription(this.state) + ' ' + getContextDescription(this.currentContext)
                const char = (curChar === Char.Whitespace.tab) ? "\\t" : String.fromCharCode(curChar)

                console.log(
                    `${stateInfo.padEnd(35)}${JSON.stringify(char).padStart(4)} ${("(" + curChar + ")").padEnd(5)}` +
                    ` ${this.line.toString().padStart(4)}:${this.column.toString().padEnd(3)}(${this.position})`,
                    currentChunkIndex
                )
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
                                    this.oncurrentdata.signal(s => s.onlinecomment($.commentNode, { start: $.start, end: this.getLocation() }))
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
                                    this.oncurrentdata.signal(s => s.onblockcomment(comment, { start: $.start, end: this.getLocation() }, this.indent))
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
                                    $.state = CommentState.LINE_COMMENT
                                } else if (curChar === Char.Comment.asterisk) {
                                    $.state = CommentState.BLOCK_COMMENT
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
                case ContextType.UNQUOTED_STRING: {
                    /**
                     * UNQUOTED STRING PROCESSING (null, true, false)
                     */
                    const $ = state[1]

                    let snippetStart: null | number = null
                    function flush() {
                        if (snippetStart !== null) {
                            $.unquotedStringNode += chunk.substring(snippetStart, currentChunkIndex)
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
                        //first check if we are breaking out of an unquoted string. Can only be done by checking the character that comes directly after the unquoted string
                        if (!this.isUnquotedStringCharacter(curChar)) {
                            flush()
                            this.wrapUpUnquotedString()
                            //this character does not belong to the keyword so don't go to the next character by breaking
                            break
                        } else {
                            //normal character
                            //don't flush
                            if (snippetStart === null) {
                                snippetStart = currentChunkIndex
                            }
                        }
                        next()
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
                                            const vt = this.getValueType(curChar)
                                            if (vt !== null) {
                                                if (this.opt.allow?.missing_commas) {
                                                    $$.state = ArrayState.EXPECTING_COMMA_OR_ARRAY_END
                                                    this.processValue(vt, curChar)
                                                } else {
                                                    this.raiseError(`Bad array, expected ',' or array end (missing commas are not allowed)`)
                                                }
                                            } else {
                                                if (this.opt.allow?.missing_commas) {
                                                    this.raiseError(`Bad array, expected ',', array end or a value`)
                                                } else {
                                                    this.raiseError(`Bad array, expected ',' or array end`)
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
                                        } else if (curChar === Char.QuotedString.quotationMark || curChar === Char.QuotedString.apostrophe) {
                                            if (this.opt.allow?.missing_commas) {
                                                this.processKey(curChar, $$)
                                            } else {
                                                this.raiseError(`Bad object, missing comma`)
                                            }
                                        } else {
                                            if (this.opt.allow?.missing_commas) {
                                                this.raiseError(`Bad object, expected ',', object end or a value`)
                                            } else {
                                                this.raiseError(`Bad object, expected ',' or object end`)
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
                                        this.oncurrentdata = this.ondata

                                        if (curChar === Char.Header.hash) {

                                            if (!this.opt.allow?.compact) {
                                                this.raiseError("compact not allowed")
                                            } else {
                                                this.onheaderdata.signal(s => s.oncompact(true, this.getOneCharacterRange()))
                                                $$.state = RootState.EXPECTING_ROOTVALUE
                                            }
                                        } else {
                                            this.onheaderdata.signal(s => s.oncompact(false, this.getOneCharacterRange()))
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
                                            this.onheaderdata.signal(s => s.onschemastart(this.getOneCharacterRange()))
                                            this.oncurrentdata = this.onschemadata
                                            $$.state = RootState.EXPECTING_SCHEMA
                                        }
                                        break
                                    case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                                        if (curChar === Char.Header.exclamationMark) {
                                            $$.state = RootState.EXPECTING_SCHEMA
                                            this.onheaderdata.signal(s => s.onschemastart(this.getOneCharacterRange()))
                                            this.oncurrentdata = this.onschemadata


                                        } else {
                                            const vt = this.getValueType(curChar)
                                            if (vt === null) {
                                                this.raiseError("expected an '!' (to specify a schema) or a value")
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
                        case StackContextType.TAGGED_UNION: {
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
                                    case TaggedUnionState.EXPECTING_OPTION:
                                        if (this.isStringStart(curChar)) {
                                            this.initString(curChar, (textNode, range) => {
                                                this.oncurrentdata.signal(s => s.onoption(textNode, range))
                                                $$.state = TaggedUnionState.EXPECTING_VALUE
                                            })
                                        } else {
                                            this.raiseError("missing tagged union string")
                                        }
                                        break
                                    case TaggedUnionState.EXPECTING_VALUE: {
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
                case ContextType.QUOTED_STRING: {
                    /**
                     * QUOTED STRING PROCESSING
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
                                if (curChar === Char.QuotedString.quotationMark) { $.textNode += '\"' }
                                else if (curChar === Char.QuotedString.apostrophe) { $.textNode += '\'' } //deviation from the JSON standard
                                else if (curChar === Char.QuotedString.reverseSolidus) { $.textNode += '\\' }
                                else if (curChar === Char.QuotedString.solidus) { $.textNode += '\/' }
                                else if (curChar === Char.QuotedString.b) { $.textNode += '\b' }
                                else if (curChar === Char.QuotedString.f) { $.textNode += '\f' }
                                else if (curChar === Char.QuotedString.n) { $.textNode += '\n' }
                                else if (curChar === Char.QuotedString.r) { $.textNode += '\r' }
                                else if (curChar === Char.QuotedString.t) { $.textNode += '\t' }
                                else if (curChar === Char.QuotedString.u) {
                                    // \uxxxx. meh!
                                    $.unicode = {
                                        charactersLeft: 4,
                                        foundCharacters: "",
                                    }
                                }
                                else {
                                    //no special character
                                    this.raiseError("expected special character after escape slash")
                                }
                                $.slashed = false
                            } else {

                                //not slashed, not unicode
                                if (curChar === Char.QuotedString.reverseSolidus) {//backslash
                                    flush()
                                    $.slashed = true
                                } else if (curChar === $.startCharacter) {
                                    /**
                                     * THE QUOTED STRING IS FINISHED
                                     */

                                    flush()
                                    const locationInfo = {
                                        start: $.start,
                                        end: this.getLocation(),
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

    public getLocation(): Location {
        return {
            position: this.position,
            line: this.line,
            column: this.column,
        }
    }

    private isUnquotedStringCharacter(curChar: number) {
        const isOtherCharacter = (false
            || curChar === Char.Whitespace.carriageReturn
            || curChar === Char.Whitespace.lineFeed
            || curChar === Char.Whitespace.space
            || curChar === Char.Whitespace.tab

            || curChar === Char.Object.closeBrace
            || curChar === Char.Object.closeParen
            || curChar === Char.Object.colon
            || curChar === Char.Object.comma
            || curChar === Char.Object.openBrace
            || curChar === Char.Object.openParen

            || curChar === Char.Array.closeAngleBracket
            || curChar === Char.Array.closeBracket
            || curChar === Char.Array.comma
            || curChar === Char.Array.openAngleBracket
            || curChar === Char.Array.openBracket

            || curChar === Char.Comment.solidus
            //|| curChar === Char.Comment.asterisk

            || curChar === Char.QuotedString.quotationMark
            || curChar === Char.QuotedString.apostrophe

            || curChar === Char.TaggedUnion.verticalLine

            || curChar === Char.Header.hash
        )
        return !isOtherCharacter
    }

    private wrapUpUnquotedString() {
        switch (this.state[0]) {
            case ContextType.COMMENT:
                break
            case ContextType.UNQUOTED_STRING:
                const $ = this.state[1]
                const end = {
                    line: this.line,
                    position: this.position - 1,
                    column: this.column - 1,
                }
                this.oncurrentdata.signal(s => s.onunquotedstring($.unquotedStringNode, { start: $.start, end: end }))
                this.setStateAfterValue()
                break
            case ContextType.STACK:
                break
            case ContextType.QUOTED_STRING:
                //strings are self closing (with a '"')
                throw new Error("unexpected string")
            default:
                return assertUnreachable(this.state[0])
        }
    }
    private closeObject(curChar: number, context: ObjectContext) {
        if (context.openChar === Char.Object.openParen && curChar !== Char.Object.closeParen) {
            this.raiseError("must close object with ')'")
        } else if (context.openChar === Char.Object.openBrace && curChar !== Char.Object.closeBrace) {
            this.raiseError("must close object with '}'")
        } else {
            this.oncurrentdata.signal(s => s.oncloseobject(this.getOneCharacterRange(), String.fromCharCode(curChar)))
            this.popContext()
        }
    }
    private closeArray(curChar: number, context: ArrayContext) {
        if (context.openChar === Char.Array.openBracket && curChar !== Char.Array.closeBracket) {
            this.raiseError("must close array with ']'")
        } else if (context.openChar === Char.Array.openAngleBracket && curChar !== Char.Array.closeAngleBracket) {
            this.raiseError("must close object with '>'")
        } else {
            this.oncurrentdata.signal(s => s.onclosearray(this.getOneCharacterRange(), String.fromCharCode(curChar)))
            this.popContext()
        }
    }


    private raiseError(message: string) {
        const error = {
            message: message,
            location: this.getLocation(),
            character: this.curChar,
        }
        this.error = error
        if (DEBUG) { console.log("error raised:", printError(error)) }
        this.onerror.signal(error)
    }
    public end() {
        this.wrapUpUnquotedString()

        if (this.error !== null) {
            return
        }
        const state = this.state
        if (state[0] !== ContextType.STACK || this.currentContext[0] !== StackContextType.ROOT || this.currentContext[1].state !== RootState.EXPECTING_END || this.stack.length !== 0) {
            this.raiseError("unexpected end, " + getStateDescription(this.state))
            return
        }

        this.ended = true
        this.oncurrentdata.signal(s => s.onend())
        this.onready.signal()
    }
    private onFoundSolidus() {
        this.wrapUpUnquotedString()
        this.setState([ContextType.COMMENT, {
            state: CommentState.FOUND_SOLIDUS,
            commentNode: "",
            start: this.getLocation(),
        }])
    }
    private setState(newState: Context) {
        if (DEBUG) console.log("setting state to", getStateDescription(newState))
        this.state = newState
    }
    private isStringStart(curChar: number) {
        return curChar === Char.QuotedString.quotationMark || curChar === Char.QuotedString.apostrophe
    }
    private initString(startCharacter: number, onFinished: OnStringFinished) {
        this.setState([ContextType.QUOTED_STRING, {
            startCharacter: startCharacter,
            start: this.getLocation(),
            textNode: "",
            onFinished: onFinished,
            unicode: null,
            slashed: false,
        }])
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
            case StackContextType.TAGGED_UNION:
                this.oncurrentdata.signal(s => s.onclosetaggedunion())
                this.popContext()
                break
            default:
                assertUnreachable(currentContext[0])
        }

    }
    private processKey(curChar: number, containingObject: ObjectContext) {
        if (curChar === Char.QuotedString.quotationMark || curChar === Char.QuotedString.apostrophe) {
            this.initString(curChar, (textNode, range) => {
                this.oncurrentdata.signal(s => s.onkey(textNode, range))
                containingObject.state = ObjectState.EXPECTING_COLON
            })
        } else {
            this.raiseError(`Malformed key, should start with '"' or '''`)
        }
    }
    private processValue(vt: ValueType, curChar: number) {
        switch (vt) {
            case ValueType.ARRAY: {
                this.oncurrentdata.signal(s => s.onopenarray(this.getOneCharacterRange(), String.fromCharCode(curChar)))
                this.pushContext([StackContextType.ARRAY, { openChar: curChar, state: ArrayState.EXPECTING_VALUE_OR_ARRAY_END }])
                break
            }
            case ValueType.UNQUOTED_STRING: {
                this.setState([ContextType.UNQUOTED_STRING, { start: this.getLocation(), unquotedStringNode: String.fromCharCode(curChar) }])
                break
            }
            case ValueType.OBJECT: {
                this.oncurrentdata.signal(s => s.onopenobject(this.getOneCharacterRange(), String.fromCharCode(curChar)))
                this.pushContext([StackContextType.OBJECT, { state: ObjectState.EXPECTING_KEY_OR_OBJECT_END, openChar: curChar }])
                break
            }
            case ValueType.QUOTED_STRING: {
                this.initString(curChar, (textNode, range) => {
                    this.oncurrentdata.signal(s => s.onquotedstring(textNode, String.fromCharCode(curChar), range))
                    this.setStateAfterValue()
                })
                break
            }
            case ValueType.TAGGED_UNION: {
                this.pushContext([StackContextType.TAGGED_UNION, { state: TaggedUnionState.EXPECTING_OPTION }])
                this.oncurrentdata.signal(s => s.onopentaggedunion(this.getOneCharacterRange()))
                break
            }
            default:
                return assertUnreachable(vt)
        }
    }
    private getValueType(curChar: number): ValueType | null {
        if (curChar === Char.QuotedString.quotationMark || curChar === Char.QuotedString.apostrophe) {
            return ValueType.QUOTED_STRING
        } else if (curChar === Char.Object.openBrace || curChar === Char.Object.openParen) {
            return ValueType.OBJECT
        } else if (curChar === Char.Array.openBracket || curChar === Char.Array.openAngleBracket) {
            return ValueType.ARRAY
        } else if (curChar === Char.TaggedUnion.verticalLine) { //extension to strict JSON specifications
            return ValueType.TAGGED_UNION
        } else {
            if (
                curChar === Char.Array.comma ||
                curChar === Char.Header.exclamationMark ||
                curChar === Char.Header.hash
            ) {
                return null
            }
            return ValueType.UNQUOTED_STRING
        }
    }
    private getOneCharacterRange(): Range {
        return {
            start: this.getLocation(),
            end: this.getLocation(),
        }
    }
}

function isWhiteSpace(curChar: number) {
    return curChar === Char.Whitespace.carriageReturn || curChar === Char.Whitespace.lineFeed || curChar === Char.Whitespace.space || curChar === Char.Whitespace.tab
}