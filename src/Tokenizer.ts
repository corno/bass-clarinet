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

    assertIsEnded(location: Location): void
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
    constructor(message: string, location: Location) {
        super(message, location)
    }
}

class CurrentChunk {
    public readonly chunk: string
    public index: number
    constructor(chunk: string) {
        this.chunk = chunk

        //start at the position just before the first character
        //because we are going to call currentChar = next() once at the beginning
        this.index = -1
    }
    next(): number | null {
        this.index++
        const char = this.chunk.charCodeAt(this.index)
        return isNaN(char) ? null : char
    }
}

enum PauseState {
    MUST_PAUSE,
    PAUSED,
    NO_PAUSE,
}

export class Tokenizer {
    private pausedState: PauseState = PauseState.NO_PAUSE
    private readonly onerror: (message: string, location: Location) => void

    private currentChunk: null | CurrentChunk = null
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

    readonly onreadyforwrite = new subscr.NoArgumentSubscribers()
    private readonly parser: IParser

    constructor(parser: IParser, onerror: (message: string, location: Location) => void, opt?: TokenizerOptions) {
        this.opt = opt || {}
        this.parser = parser
        this.state = [ContextType.STACK]
        this.onerror = onerror
    }
    public canWrite() {
        if (this.pausedState === PauseState.PAUSED) {
            return false
        }
        if (this.error !== null) {
            return false
        }
        if (this.ended) {
            return false
        }
        return true
    }
    public write(chunk: string) {
        if (!this.canWrite()) {
            throw new Error("cannot write")
        }
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
        this.currentChunk = new CurrentChunk(chunk)
        this.writeImp(this.currentChunk)
    }
    public pause() {
        this.pausedState = PauseState.MUST_PAUSE
    }
    public continue() {
        if (this.pausedState === PauseState.PAUSED) {
            this.pausedState = PauseState.NO_PAUSE
            if (this.currentChunk !== null) {
                this.writeImp(this.currentChunk)
            }
        } else {
            this.pausedState = PauseState.NO_PAUSE
        }
    }
    public isPaused() {
        return this.pausedState !== PauseState.NO_PAUSE
    }
    private writeImp(currentChunk: CurrentChunk) {
        const next = () => {
            const cc = currentChunk.next()


            if (DEBUG) {
                const stateInfo = getStateDescription(this.state)
                const char = (cc === Char.Whitespace.tab) ? "\\t" : cc === null ? "\\0" : String.fromCharCode(cc)

                console.log(
                    `${stateInfo.padEnd(35)}${JSON.stringify(char).padStart(4)} ${("(" + cc + ")").padEnd(5)}` +
                    ` ${this.line.toString().padStart(4)}:${this.column.toString().padEnd(3)}(${this.position})`,
                    currentChunk.index
                )
            }
            if (cc === null) {
                this.currentChunk = null
                this.onreadyforwrite.signal()
            } else {
                this.position++
                //set the position
                switch (cc) {
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
            return cc
        }
        let currentChar = next()
        while (true) {
            if (this.error !== null) {
                return
            }
            const tmpPS = this.pausedState
            if (tmpPS === PauseState.MUST_PAUSE) {
                this.pausedState = PauseState.PAUSED
                return
            }
            if (currentChar === null) {
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
                            this.parser.onSnippet(currentChunk.chunk, snippetStart, currentChunk.index + (offset === undefined ? 0 : offset))
                        }
                        snippetStart = null
                    }

                    commentLoop: while (true) {
                        //if (DEBUG) console.log(currentChunk.index, currentChar, String.fromCharCode(currentChar), 'string loop', $.slashed, $.textNode)

                        if (this.error !== null) {
                            return
                        }
                        if (this.pausedState === PauseState.MUST_PAUSE) {
                            this.pausedState = PauseState.PAUSED
                            flush()
                            return
                        }
                        if (currentChar === null) {
                            //end of the chunk
                            //store it and wait for more input
                            flush()
                            return
                        }
                        switch ($.state) {
                            case CommentState.BLOCK_COMMENT:
                                if (snippetStart === null) {
                                    snippetStart = currentChunk.index
                                }
                                if (currentChar === Char.Comment.asterisk) {
                                    $.state = CommentState.FOUND_ASTERISK
                                    //possible end of comment
                                    flush()
                                }
                                break
                            case CommentState.LINE_COMMENT:
                                if (currentChar === Char.Whitespace.lineFeed || currentChar === Char.Whitespace.carriageReturn) {
                                    //end of line comment
                                    this.setState([ContextType.STACK])
                                    flush()
                                    this.parser.onLineCommentEnd(this.getLocation())
                                    currentChar = next()
                                    break commentLoop
                                } else {
                                    if (snippetStart === null) {
                                        snippetStart = currentChunk.index
                                    }
                                }
                                break
                            case CommentState.FOUND_ASTERISK:
                                if (currentChar === Char.Comment.solidus) {
                                    //end of block comment
                                    this.setState([ContextType.STACK])
                                    this.parser.onBlockCommentEnd({ start: this.getLocation(-1), end: this.getLocation(1) })
                                    currentChar = next()
                                    break commentLoop
                                } else {
                                    //false alarm, not the end of the comment
                                    this.parser.onSnippet("*", 0, 1)
                                    if (snippetStart === null) {
                                        snippetStart = currentChunk.index
                                    }
                                    $.state = CommentState.BLOCK_COMMENT
                                }
                                break
                            case CommentState.FOUND_SOLIDUS:
                                if (currentChar === Char.Comment.solidus) {
                                    this.parser.onLineCommentBegin({ start: this.getLocation(-1), end: this.getLocation(1) })
                                    $.state = CommentState.LINE_COMMENT
                                } else if (currentChar === Char.Comment.asterisk) {
                                    this.parser.onBlockCommentBegin({ start: this.getLocation(-1), end: this.getLocation(1) }, this.indent)
                                    $.state = CommentState.BLOCK_COMMENT
                                } else {
                                    this.raiseError("found dangling slash")
                                }
                                break
                            default: assertUnreachable($.state)
                        }
                        currentChar = next()
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
                            this.parser.onSnippet(currentChunk.chunk, snippetStart, currentChunk.index)
                        }
                        snippetStart = null
                    }

                    while (true) {
                        if (this.error !== null) {
                            return
                        }
                        if (this.pausedState === PauseState.MUST_PAUSE) {
                            this.pausedState = PauseState.PAUSED
                            flush()
                            return
                        }
                        if (currentChar === null) {
                            //end of the chunk
                            //store it and wait for more input
                            flush()
                            return
                        }


                        function isUnquotedTokenCharacter() {
                            const isOtherCharacter = (false
                                || currentChar === Char.Whitespace.carriageReturn
                                || currentChar === Char.Whitespace.lineFeed
                                || currentChar === Char.Whitespace.space
                                || currentChar === Char.Whitespace.tab

                                || currentChar === Char.Object.closeBrace
                                || currentChar === Char.Object.closeParen
                                || currentChar === Char.Object.colon
                                || currentChar === Char.Object.comma
                                || currentChar === Char.Object.openBrace
                                || currentChar === Char.Object.openParen

                                || currentChar === Char.Array.closeAngleBracket
                                || currentChar === Char.Array.closeBracket
                                || currentChar === Char.Array.comma
                                || currentChar === Char.Array.openAngleBracket
                                || currentChar === Char.Array.openBracket

                                || currentChar === Char.Comment.solidus
                                //|| currentChar === Char.Comment.asterisk

                                || currentChar === Char.QuotedString.quotationMark
                                || currentChar === Char.QuotedString.apostrophe

                                || currentChar === Char.TaggedUnion.verticalLine

                                || currentChar === Char.Header.hash
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
                                snippetStart = currentChunk.index
                            }
                        }
                        currentChar = next()
                    }
                    break
                }
                case ContextType.STACK: {
                    while (
                        currentChar === Char.Whitespace.carriageReturn ||
                        currentChar === Char.Whitespace.lineFeed ||
                        currentChar === Char.Whitespace.space ||
                        currentChar === Char.Whitespace.tab
                    ) {
                        currentChar = next()
                        if (this.pausedState === PauseState.MUST_PAUSE) {
                            this.pausedState = PauseState.PAUSED
                            return
                        }
                        if (currentChar === null) {
                            return
                        }
                    }
                    this.indent = null

                    function getSimpleValueType(): SimpleValueType | null {
                        if (currentChar === Char.QuotedString.quotationMark || currentChar === Char.QuotedString.apostrophe) {
                            return SimpleValueType.QUOTED_STRING
                        } else if (currentChar === Char.Object.openBrace || currentChar === Char.Object.openParen) {
                            return null
                        } else if (currentChar === Char.Array.openBracket || currentChar === Char.Array.openAngleBracket) {
                            return null
                        } else if (currentChar === Char.TaggedUnion.verticalLine) { //extension to strict JSON specifications
                            return null
                        } else {
                            if (
                                currentChar === Char.Array.comma ||
                                currentChar === Char.Array.closeBracket ||
                                currentChar === Char.Array.closeAngleBracket ||
                                currentChar === Char.Object.closeParen ||
                                currentChar === Char.Object.closeBrace ||
                                currentChar === Char.Object.colon ||
                                currentChar === Char.Header.exclamationMark ||
                                currentChar === Char.Header.hash
                            ) {
                                return null
                            }
                            return SimpleValueType.UNQUOTED_STRING
                        }
                    }
                    const valueType = getSimpleValueType()
                    if (currentChar === Char.Comment.solidus) {
                        this.wrapUpUnquotedToken()
                        this.setState([ContextType.COMMENT, {
                            state: CommentState.FOUND_SOLIDUS,
                        }])
                    } else if (valueType !== null) {
                        if (valueType === SimpleValueType.QUOTED_STRING) {
                            this.setState([ContextType.QUOTED_STRING, {
                                startCharacter: currentChar,
                                slashed: false,
                                unicode: null,
                            }])
                            this.parser.onQuotedStringBegin({ start: this.getLocation(0), end: this.getLocation(1) }, String.fromCharCode(currentChar))
                        } else {
                            this.setState([ContextType.UNQUOTED_STRING])
                            this.parser.onUnquotedTokenBegin(this.getLocation())
                            this.parser.onSnippet(currentChunk.chunk, currentChunk.index, currentChunk.index + 1) //copy current character

                        }
                    } else {
                        this.parser.onPunctuation(currentChar, {
                            start: this.getLocation(),
                            end: this.getLocation(1),
                        })
                    }
                    currentChar = next()
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
                            this.parser.onSnippet(currentChunk.chunk, snippetStart, currentChunk.index)
                        }
                        snippetStart = null
                    }

                    while (true) {
                        //if (DEBUG) console.log(currentChunk.index, currentChar, String.fromCharCode(currentChar), 'string loop', $.slashed, $.textNode)
                        if (this.error !== null) {
                            return
                        }
                        if (this.pausedState === PauseState.MUST_PAUSE) {
                            this.pausedState = PauseState.PAUSED
                            flush()
                            return
                        }
                        if (currentChar === null) {
                            //end of the chunk
                            //store it and wait for more input
                            flush()
                            return
                        }
                        if ($.slashed) {
                            const flushChar = (str: string) => {
                                this.parser.onSnippet(str, 0, str.length)
                            }
                            if (currentChar === Char.QuotedString.quotationMark) { flushChar('\"') }
                            else if (currentChar === Char.QuotedString.apostrophe) { flushChar('\'') } //deviation from the JSON standard
                            else if (currentChar === Char.QuotedString.reverseSolidus) { flushChar('\\') }
                            else if (currentChar === Char.QuotedString.solidus) { flushChar('\/') }
                            else if (currentChar === Char.QuotedString.b) { flushChar('\b') }
                            else if (currentChar === Char.QuotedString.f) { flushChar('\f') }
                            else if (currentChar === Char.QuotedString.n) { flushChar('\n') }
                            else if (currentChar === Char.QuotedString.r) { flushChar('\r') }
                            else if (currentChar === Char.QuotedString.t) { flushChar('\t') }
                            else if (currentChar === Char.QuotedString.u) {
                                // \uxxxx
                                $.unicode = {
                                    charactersLeft: 4,
                                    foundCharacters: "",
                                }
                            }
                            else {
                                //no special character
                                this.raiseError(`expected special character after escape slash, but found ${String.fromCharCode(currentChar)}`)
                            }
                            $.slashed = false

                        } else if ($.unicode !== null) {
                            $.unicode.foundCharacters += String.fromCharCode(currentChar)
                            $.unicode.charactersLeft--
                            if ($.unicode.charactersLeft === 0) {
                                const textNode = String.fromCharCode(parseInt($.unicode.foundCharacters, 16))
                                this.parser.onSnippet(textNode, 0, textNode.length)
                                $.unicode = null
                            }
                        } else {
                            //not slashed, not unicode
                            if (currentChar === Char.QuotedString.reverseSolidus) {//backslash
                                flush()
                                $.slashed = true
                            } else if (currentChar === $.startCharacter) {
                                /**
                                 * THE QUOTED STRING IS FINISHED
                                 */
                                flush()
                                const locationInfo = {
                                    start: this.getLocation(),
                                    end: this.getLocation(1),
                                }
                                this.setState([ContextType.STACK])
                                this.parser.onQuotedStringEnd(locationInfo, String.fromCharCode(currentChar))
                                currentChar = next()
                                break
                            } else {
                                //normal character
                                //don't flush
                                if (snippetStart === null) {
                                    snippetStart = currentChunk.index
                                }
                            }
                        }
                        currentChar = next()
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
    public end() {
        if (!this.canWrite()) {
            throw new Error("cannot end")
        }
        this.wrapUpUnquotedToken()

        if (this.error !== null) {
            return
        }
        const state = this.state
        if (state[0] !== ContextType.STACK) {
            this.raiseError("unexpected end of document")
            return
        }
        this.parser.assertIsEnded(this.getLocation(1))

        this.ended = true
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
            this.getLocation(),
        )
        if (DEBUG) { console.log("error raised:", this.error.message) }
        this.onerror(message, this.getLocation())
    }
    private setState(newState: Context) {
        if (DEBUG) console.log("setting state to", getStateDescription(newState))
        this.state = newState
    }
}
