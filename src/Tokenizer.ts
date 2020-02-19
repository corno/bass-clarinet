/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/

import * as subscr from "./subscription"
import * as Char from "./Characters"
import {
    ContextType,
    Context,
    CommentState,
    SimpleValueType,
} from "./tokenizerStateTypes"
import { Location, Range } from "./location"
import { TokenizerOptions } from "./configurationTypes"
import { LocationError } from "./errors"

const DEBUG = false
const INFO = false


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}
export interface IParser {
    onSnippet(chunk: string, begin: number, end: number): void
    onLineCommentBegin(range: Range): void
    onLineCommentEnd(location: Location): void

    onBlockCommentBegin(range: Range, indent: null | string): void
    onBlockCommentEnd(range: Range): void

    onUnquotedTokenBegin(location: Location): void
    onUnquotedTokenEnd(location: Location): void

    onQuotedStringBegin(range: Range, quote: string): void
    onQuotedStringEnd(range: Range, quote: string): void

    onPunctuation(char: number, range: Range): void

    onEnd(location: Location): void
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

export class TokenizerError extends LocationError {
    readonly character: number
    constructor(message: string, character: number, location: Location) {
        super(`${message} ${String.fromCharCode(character)}' (${character})`, location)
        this.character = character
    }
}

export class Tokenizer {
    readonly onerror = new subscr.OneArgumentSubscribers<TokenizerError>()
    private curChar = 0
    private ended = false

    public readonly opt: TokenizerOptions


    // mostly just for error reporting
    private position = -1
    private column = 0
    private line = 1

    private state: Context
    private error: TokenizerError | null = null

    /**
     * the indent property keeps track of the whitespace characters after a newline.
     * when a block comment is reported, this indent will be sent along so that the
     * leading whitespace of the full block can be stripped
     */
    private indent: string | null = null

    readonly onready = new subscr.NoArgumentSubscribers()
    private readonly parser: IParser

    constructor(parser: IParser, opt?: TokenizerOptions) {
        if (INFO) console.log('-- emit', "onready")
        this.opt = opt || {}
        this.onready.signal()
        this.parser = parser
        this.state = [ContextType.STACK]
    }

    public write(chunk: string) {
        if (this.error !== null) {
            throw this.error
        }
        if (this.ended) {
            this.raiseError("Cannot write after close. Assign an onready handler.")
        }
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
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
                const stateInfo = getStateDescription(this.state)
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
                    const flush = (offset?: number) => {
                        if (snippetStart !== null) {
                            this.parser.onSnippet(chunk, snippetStart, currentChunkIndex + (offset === undefined ? 0 : offset))
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
                                    //possible end of comment
                                    flush()
                                }
                                break
                            case CommentState.LINE_COMMENT:
                                if (curChar === Char.Whitespace.lineFeed || curChar === Char.Whitespace.carriageReturn) {
                                    //end of line comment
                                    this.setState([ContextType.STACK])
                                    flush()
                                    this.parser.onLineCommentEnd(this.getLocation())
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
                                    this.parser.onBlockCommentEnd({ start: this.getLocation(-1), end: this.getLocation(1) })
                                    next()
                                    break commentLoop
                                } else {
                                    //false alarm, not the end of the comment
                                    this.parser.onSnippet("*", 0, 1)
                                    if (snippetStart === null) {
                                        snippetStart = currentChunkIndex
                                    }
                                    $.state = CommentState.BLOCK_COMMENT
                                }
                                break
                            case CommentState.FOUND_SOLIDUS:
                                if (curChar === Char.Comment.solidus) {
                                    this.parser.onLineCommentBegin({ start: this.getLocation(-1), end: this.getLocation(1) })
                                    $.state = CommentState.LINE_COMMENT
                                } else if (curChar === Char.Comment.asterisk) {
                                    this.parser.onBlockCommentBegin({ start: this.getLocation(-1), end: this.getLocation(1) }, this.indent)
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
                     * unquoted token PROCESSING (null, true, false)
                     */

                    let snippetStart: null | number = null
                    const flush = () => {
                        if (snippetStart !== null) {
                            this.parser.onSnippet(chunk, snippetStart, currentChunkIndex)
                        }
                        snippetStart = null
                    }

                    while (true) {
                        if (this.error !== null) {
                            return
                        }
                        if (isNaN(curChar)) {
                            //end of the chunk
                            //store it and wait for more input
                            flush()
                            return
                        }


                        function isUnquotedTokenCharacter() {
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
                        //first check if we are breaking out of an unquoted token. Can only be done by checking the character that comes directly after the unquoted token
                        if (!isUnquotedTokenCharacter()) {
                            flush()
                            this.wrapUpUnquotedToken()
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
                    while (curChar === Char.Whitespace.carriageReturn || curChar === Char.Whitespace.lineFeed || curChar === Char.Whitespace.space || curChar === Char.Whitespace.tab) {
                        next()
                        if (isNaN(curChar)) {
                            return
                        }
                    }
                    this.indent = null

                    function getSimpleValueType(): SimpleValueType | null {
                        if (curChar === Char.QuotedString.quotationMark || curChar === Char.QuotedString.apostrophe) {
                            return SimpleValueType.QUOTED_STRING
                        } else if (curChar === Char.Object.openBrace || curChar === Char.Object.openParen) {
                            return null
                        } else if (curChar === Char.Array.openBracket || curChar === Char.Array.openAngleBracket) {
                            return null
                        } else if (curChar === Char.TaggedUnion.verticalLine) { //extension to strict JSON specifications
                            return null
                        } else {
                            if (
                                curChar === Char.Array.comma ||
                                curChar === Char.Array.closeBracket ||
                                curChar === Char.Array.closeAngleBracket ||
                                curChar === Char.Object.closeParen ||
                                curChar === Char.Object.closeBrace ||
                                curChar === Char.Object.colon ||
                                curChar === Char.Header.exclamationMark ||
                                curChar === Char.Header.hash
                            ) {
                                return null
                            }
                            return SimpleValueType.UNQUOTED_STRING
                        }
                    }
                    const valueType = getSimpleValueType()
                    if (curChar === Char.Comment.solidus) {
                        this.wrapUpUnquotedToken()
                        this.setState([ContextType.COMMENT, {
                            state: CommentState.FOUND_SOLIDUS,
                        }])
                    } else if (valueType !== null) {
                        if (valueType === SimpleValueType.QUOTED_STRING) {
                            this.setState([ContextType.QUOTED_STRING, {
                                startCharacter: curChar,
                                slashed: false,
                                unicode: null,
                            }])
                            this.parser.onQuotedStringBegin({ start: this.getLocation(0), end: this.getLocation(1) }, String.fromCharCode(curChar))
                        } else {
                            this.setState([ContextType.UNQUOTED_STRING])
                            this.parser.onUnquotedTokenBegin(this.getLocation())
                            this.parser.onSnippet(chunk, currentChunkIndex, currentChunkIndex + 1) //copy current character

                        }
                    } else {
                        this.parser.onPunctuation(curChar, {
                            start: this.getLocation(),
                            end: this.getLocation(1),
                        })
                    }
                    next()
                    break
                }
                case ContextType.QUOTED_STRING: {
                    /**
                     * QUOTED STRING PROCESSING
                     */
                    const $ = state[1]

                    let snippetStart: null | number = null
                    const flush = () => {
                        if (snippetStart !== null) {
                            this.parser.onSnippet(chunk, snippetStart, currentChunkIndex)
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
                        if ($.slashed) {
                            const flushChar = (str: string) => {
                                this.parser.onSnippet(str, 0, str.length)
                            }
                            if (curChar === Char.QuotedString.quotationMark) { flushChar('\"') }
                            else if (curChar === Char.QuotedString.apostrophe) { flushChar('\'') } //deviation from the JSON standard
                            else if (curChar === Char.QuotedString.reverseSolidus) { flushChar('\\') }
                            else if (curChar === Char.QuotedString.solidus) { flushChar('\/') }
                            else if (curChar === Char.QuotedString.b) { flushChar('\b') }
                            else if (curChar === Char.QuotedString.f) { flushChar('\f') }
                            else if (curChar === Char.QuotedString.n) { flushChar('\n') }
                            else if (curChar === Char.QuotedString.r) { flushChar('\r') }
                            else if (curChar === Char.QuotedString.t) { flushChar('\t') }
                            else if (curChar === Char.QuotedString.u) {
                                // \uxxxx
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

                        } else if ($.unicode !== null) {
                            $.unicode.foundCharacters += String.fromCharCode(curChar)
                            $.unicode.charactersLeft--
                            if ($.unicode.charactersLeft === 0) {
                                const textNode = String.fromCharCode(parseInt($.unicode.foundCharacters, 16))
                                this.parser.onSnippet(textNode, 0, textNode.length)
                                $.unicode = null
                            }
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
                                    start: this.getLocation(),
                                    end: this.getLocation(1),
                                }
                                this.setState([ContextType.STACK])
                                this.parser.onQuotedStringEnd(locationInfo, String.fromCharCode(curChar))
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
                        next()
                    }
                    break
                }
                default: assertUnreachable(state[0])
            }
        }
    }
    public isInErrorState() {
        return this.error !== null
    }
    public close() {
        if (this.error !== null) {
            throw this.error
        }
        if (this.ended) {
            this.raiseError("Already closed.")
        }
        return this.end()
    }
    public end() {
        this.wrapUpUnquotedToken()

        if (this.error !== null) {
            return
        }
        const state = this.state
        if (state[0] !== ContextType.STACK) {
            this.raiseError("unexpected end of document")
            return
        }
        this.parser.onEnd(this.getLocation(1))

        this.ended = true
        this.onready.signal()
    }

    private getLocation(offset?: number): Location {
        return {
            position: this.position + (offset === undefined ? 0 : offset),
            line: this.line,
            column: this.column + (offset === undefined ? 0 : offset),
        }
    }
    private wrapUpUnquotedToken() {
        switch (this.state[0]) {
            case ContextType.COMMENT:
                break
            case ContextType.UNQUOTED_STRING:
                this.parser.onUnquotedTokenEnd(this.getLocation())

                this.setState([ContextType.STACK])

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
    private raiseError(message: string) {
        this.error = new TokenizerError(
            message,
            this.curChar,
            this.getLocation(),
        )
        if (DEBUG) { console.log("error raised:", this.error.message) }
        this.onerror.signal(this.error)
    }
    private setState(newState: Context) {
        if (DEBUG) console.log("setting state to", getStateDescription(newState))
        this.state = newState
    }
}
