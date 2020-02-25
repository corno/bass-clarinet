/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/

import * as Char from "./Characters"
import {
    ContextType,
    Context,
    CommentState,
    SimpleValueType,
} from "./tokenizerStateTypes"
import { Location, Range } from "./location"
import { TokenizerOptions } from "./configurationTypes"
import { IParser, Pauser } from "./parserAPI"

const DEBUG = false

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

function getStateDescription(stackContext: Context): string {
    switch (stackContext[0]) {
        case ContextType.COMMENT: return "COMMENT"
        case ContextType.UNQUOTED_TOKEN: return "UNQUOTED_STRING"
        case ContextType.STACK: return "STACK"
        case ContextType.QUOTED_STRING: return "QUOTED_STRING"
        default: return assertUnreachable(stackContext[0])

    }
}

class ProcessingData {
    public readonly chunk: string
    public index: number
    public mustPause = false
    public sourcePauser: Pauser
    constructor(chunk: string, sourcePauser: Pauser) {
        this.chunk = chunk
        this.sourcePauser = sourcePauser

        //start at the position just before the first character
        //because we are going to call currentChar = next() once at the beginning
        this.index = -1
    }
    next(): number | null {
        this.index++
        const char = this.chunk.charCodeAt(this.index)
        return isNaN(char) ? null : char
    }
    lookahead(): number | null {
        const char = this.chunk.charCodeAt(this.index + 1)
        return isNaN(char) ? null : char
    }
}

export class Tokenizer {
    private readonly onerror: (message: string, range: Range) => void

    private currentChunk: null | ProcessingData = null
    private ended = false

    public readonly opt: TokenizerOptions

    private readonly queue: (ProcessingData | null)[] = []


    // mostly just for error reporting
    private position = -1
    private column = 0
    private line = 1

    private state: Context

    /**
     * the indent property keeps track of the whitespace characters after a newline.
     * when a block comment is reported, this indent will be sent along so that the
     * leading whitespace of the full block can be stripped
     */
    private indent: string | null = null

    private readonly parser: IParser

    constructor(parser: IParser, onerror: (message: string, range: Range) => void, opt?: TokenizerOptions) {
        this.opt = opt || {}
        this.parser = parser
        this.state = [ContextType.STACK]
        this.onerror = onerror
    }
    public write(chunk: string, sourcePauser: Pauser) {
        if (this.ended) {
            throw new Error("cannot write, stream is ended")
        }
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
        if (this.currentChunk === null) {
            this.currentChunk = new ProcessingData(chunk, sourcePauser)
            this.writeImp(this.currentChunk)
            this.emptyQueue()
        } else {
            this.queue.push(new ProcessingData(chunk, sourcePauser))
        }
    }
    private emptyQueue() {
        while (this.currentChunk === null) {
            const nextChunk = this.queue.pop()
            if (nextChunk !== undefined) {
                if (nextChunk === null) {
                    this.onEnd()
                } else {
                    this.writeImp(new ProcessingData(nextChunk.chunk, nextChunk.sourcePauser))
                }
            } else {
                return
            }
        }
    }
    private next(currentChunk: ProcessingData) {
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
    private writeImp(currentChunk: ProcessingData) {
        const pauser: Pauser = {
            pause: () => {
                currentChunk.mustPause = true
                currentChunk.sourcePauser.pause()
            },
            continue: () => {
                currentChunk.mustPause = false
                if (this.currentChunk !== null) {
                    this.writeImp(this.currentChunk)
                }
                this.emptyQueue()
                currentChunk.sourcePauser.continue()
            },
        }
        while (true) {
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
                            this.parser.onSnippet(currentChunk.chunk, snippetStart, currentChunk.index + (offset === undefined ? 0 : offset), pauser)
                            if (currentChunk.mustPause) {
                                return
                            }
                        }
                        snippetStart = null
                    }

                    commentLoop: while (true) {
                        //if (DEBUG) console.log(currentChunk.index, currentChar, String.fromCharCode(currentChar), 'string loop', $.slashed, $.textNode)
                        const currentChar = this.next(currentChunk)


                        if (currentChar === null) {
                            //end of the chunk
                            //store it and wait for more input
                            flush()
                            return
                        }
                        switch ($.state[0]) {
                            case CommentState.BLOCK_COMMENT:
                                if (snippetStart === null) {
                                    snippetStart = currentChunk.index
                                }
                                if (currentChar === Char.Comment.asterisk) {
                                    $.state = [CommentState.FOUND_ASTERISK, { start: this.getBeginLocation() }]
                                    //possible end of comment
                                    flush()
                                }
                                break
                            case CommentState.LINE_COMMENT:
                                if (currentChar === Char.Whitespace.lineFeed || currentChar === Char.Whitespace.carriageReturn) {
                                    //end of line comment
                                    this.setState([ContextType.STACK])
                                    flush()
                                    this.parser.onLineCommentEnd(this.getEndLocation(), pauser)
                                    if (currentChunk.mustPause) {
                                        return
                                    }
                                    break commentLoop
                                } else {
                                    if (snippetStart === null) {
                                        snippetStart = currentChunk.index
                                    }
                                }
                                break
                            case CommentState.FOUND_ASTERISK: {
                                const $$ = $.state[1]
                                if (currentChar === Char.Comment.solidus) {
                                    //end of block comment
                                    this.setState([ContextType.STACK])
                                    this.parser.onBlockCommentEnd({ start: $$.start, end: this.getEndLocation() }, pauser)

                                    if (currentChunk.mustPause) {
                                        return
                                    }
                                    break commentLoop
                                } else {
                                    //false alarm, not the end of the comment
                                    this.parser.onSnippet("*", 0, 1, pauser)

                                    if (currentChunk.mustPause) {
                                        return
                                    }
                                    if (snippetStart === null) {
                                        snippetStart = currentChunk.index
                                    }
                                    $.state = [CommentState.BLOCK_COMMENT]
                                }
                                break
                            }
                            case CommentState.FOUND_SOLIDUS: {
                                const $$ = $.state[1]

                                if (currentChar === Char.Comment.solidus) {
                                    this.parser.onLineCommentBegin({ start: $$.start, end: this.getEndLocation() }, pauser)

                                    if (currentChunk.mustPause) {
                                        return
                                    }
                                    $.state = [CommentState.LINE_COMMENT]
                                } else if (currentChar === Char.Comment.asterisk) {
                                    this.parser.onBlockCommentBegin({ start: $$.start, end: this.getEndLocation() }, this.indent, pauser)

                                    if (currentChunk.mustPause) {
                                        return
                                    }
                                    $.state = [CommentState.BLOCK_COMMENT]
                                } else {
                                    this.raiseError("found dangling slash", { start: this.getBeginLocation(), end: this.getEndLocation() })
                                    this.setState([ContextType.STACK])

                                }
                                break
                            }
                            default: assertUnreachable($.state)
                        }
                    }

                    break
                }
                case ContextType.UNQUOTED_TOKEN: {
                    /**
                     * unquoted token PROCESSING (null, true, false)
                     */
                    let snippetStart: null | number = null
                    const flush = () => {
                        if (snippetStart !== null) {
                            this.parser.onSnippet(currentChunk.chunk, snippetStart, currentChunk.index + 1, pauser)

                            if (currentChunk.mustPause) {
                                return
                            }
                        }
                        snippetStart = null
                    }

                    while (true) {
                        const nextChar = currentChunk.lookahead()
                        if (nextChar === null) {
                            this.currentChunk = null
                            flush()
                            return
                        }

                        function isUnquotedTokenCharacter() {
                            const isOtherCharacter = (false
                                || nextChar === Char.Whitespace.carriageReturn
                                || nextChar === Char.Whitespace.lineFeed
                                || nextChar === Char.Whitespace.space
                                || nextChar === Char.Whitespace.tab

                                || nextChar === Char.Object.closeBrace
                                || nextChar === Char.Object.closeParen
                                || nextChar === Char.Object.colon
                                || nextChar === Char.Object.comma
                                || nextChar === Char.Object.openBrace
                                || nextChar === Char.Object.openParen

                                || nextChar === Char.Array.closeAngleBracket
                                || nextChar === Char.Array.closeBracket
                                || nextChar === Char.Array.comma
                                || nextChar === Char.Array.openAngleBracket
                                || nextChar === Char.Array.openBracket

                                || nextChar === Char.Comment.solidus
                                //|| nextChar === Char.Comment.asterisk

                                || nextChar === Char.QuotedString.quotationMark
                                || nextChar === Char.QuotedString.apostrophe

                                || nextChar === Char.TaggedUnion.verticalLine

                                || nextChar === Char.Header.hash
                            )
                            return !isOtherCharacter
                        }
                        //first check if we are breaking out of an unquoted token. Can only be done by checking the character that comes directly after the unquoted token
                        if (!isUnquotedTokenCharacter()) {
                            flush()

                            this.parser.onUnquotedTokenEnd(this.getEndLocation())

                            this.setState([ContextType.STACK])
                            //this character does not belong to the keyword so don't go to the next character by breaking
                            break
                        } else {
                            //normal character
                            //don't flush
                            this.next(currentChunk)
                            if (snippetStart === null) {
                                snippetStart = currentChunk.index
                            }
                        }
                    }
                    break
                }
                case ContextType.STACK: {
                    const currentChar = this.next(currentChunk)

                    if (
                        currentChar === Char.Whitespace.carriageReturn ||
                        currentChar === Char.Whitespace.lineFeed ||
                        currentChar === Char.Whitespace.space ||
                        currentChar === Char.Whitespace.tab
                    ) {
                        continue
                    }
                    if (currentChar === null) {
                        //end of chunk reached
                        return
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
                        this.setState([ContextType.COMMENT, {
                            state: [CommentState.FOUND_SOLIDUS, { start: this.getBeginLocation() }],
                        }])
                    } else if (valueType !== null) {
                        if (valueType === SimpleValueType.QUOTED_STRING) {
                            this.setState([ContextType.QUOTED_STRING, {
                                startCharacter: currentChar,
                                slashed: false,
                                unicode: null,
                            }])
                            this.parser.onQuotedStringBegin({ start: this.getBeginLocation(), end: this.getEndLocation() }, String.fromCharCode(currentChar), pauser)
                            if (currentChunk.mustPause) {
                                return
                            }
                        } else {
                            this.setState([ContextType.UNQUOTED_TOKEN])
                            this.parser.onUnquotedTokenBegin(this.getBeginLocation(), pauser)
                            if (currentChunk.mustPause) {
                                return
                            }
                            this.parser.onSnippet(currentChunk.chunk, currentChunk.index, currentChunk.index + 1, pauser) //copy current character
                            if (currentChunk.mustPause) {
                                return
                            }

                        }
                    } else {
                        this.parser.onPunctuation(currentChar, {
                            start: this.getBeginLocation(),
                            end: this.getEndLocation(),
                        }, pauser)
                        if (currentChunk.mustPause) {
                            return
                        }
                    }
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
                            this.parser.onSnippet(currentChunk.chunk, snippetStart, currentChunk.index, pauser)
                            if (currentChunk.mustPause) {
                                return
                            }
                        }
                        snippetStart = null
                    }

                    quotedStringLoop: while (true) {
                        //if (DEBUG) console.log(currentChunk.index, currentChar, String.fromCharCode(currentChar), 'string loop', $.slashed, $.textNode)
                        const currentChar = this.next(currentChunk)

                        if (currentChar === null) {
                            //end of the chunk
                            //store it and wait for more input
                            flush()
                            return
                        }
                        if ($.slashed) {
                            const flushChar = (str: string) => {
                                this.parser.onSnippet(str, 0, str.length, pauser)
                                if (currentChunk.mustPause) {
                                    return
                                }
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
                                this.raiseError(
                                    `expected special character after escape slash, but found ${String.fromCharCode(currentChar)}`,
                                    { start: this.getBeginLocation(), end: this.getEndLocation() }
                                )
                            }
                            $.slashed = false

                        } else if ($.unicode !== null) {
                            $.unicode.foundCharacters += String.fromCharCode(currentChar)
                            $.unicode.charactersLeft--
                            if ($.unicode.charactersLeft === 0) {
                                const textNode = String.fromCharCode(parseInt($.unicode.foundCharacters, 16))
                                this.parser.onSnippet(textNode, 0, textNode.length, pauser)
                                if (currentChunk.mustPause) {
                                    return
                                }
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
                                    start: this.getBeginLocation(),
                                    end: this.getEndLocation(),
                                }
                                this.setState([ContextType.STACK])
                                this.parser.onQuotedStringEnd(locationInfo, String.fromCharCode(currentChar), pauser)
                                if (currentChunk.mustPause) {
                                    return
                                }
                                break quotedStringLoop
                            } else {
                                //normal character
                                //don't flush
                                if (snippetStart === null) {
                                    snippetStart = currentChunk.index
                                }
                            }
                        }
                    }
                    break
                }
                default: assertUnreachable(state[0])
            }
        }
    }
    public end() {
        if (this.ended) {
            throw new Error("cannot end, already ended")
        }
        if (this.currentChunk !== null) {
            this.queue.push(null)
        } else {
            this.onEnd()
        }
    }
    private onEnd() {
        switch (this.state[0]) {
            case ContextType.COMMENT: {
                const $ = this.state[1]
                if ($.state[0] === CommentState.BLOCK_COMMENT) {
                    this.raiseError("unterminated block comment", { start: this.getEndLocation(), end: this.getEndLocation() })
                    const locationInfo = {
                        start: this.getEndLocation(),
                        end: this.getEndLocation(),
                    }
                    this.parser.onBlockCommentEnd(locationInfo, null)
                    this.setState([ContextType.STACK])
                }
                break
            }
            case ContextType.UNQUOTED_TOKEN:
                this.parser.onUnquotedTokenEnd(this.getEndLocation())

                this.setState([ContextType.STACK])

                break
            case ContextType.STACK:
                break
            case ContextType.QUOTED_STRING: {
                this.raiseError("unterminated string", { start: this.getEndLocation(), end: this.getEndLocation() })

                const locationInfo = {
                    start: this.getEndLocation(),
                    end: this.getEndLocation(),
                }
                this.parser.onQuotedStringEnd(locationInfo, null, null)
                this.setState([ContextType.STACK])
                break
            }
            default:
                return assertUnreachable(this.state[0])
        }
        this.parser.assertIsEnded(this.getEndLocation())

        this.ended = true
    }
    private getEndLocation(): Location {
        return {
            position: this.position + 1,
            line: this.line,
            column: this.column + 1,
        }
    }
    private getBeginLocation(): Location {
        return {
            position: this.position,
            line: this.line,
            column: this.column,
        }
    }
    private raiseError(message: string, range: Range) {
        if (DEBUG) { console.log("error raised:", message) }
        this.onerror(message, range)
    }
    private setState(newState: Context) {
        if (DEBUG) console.log("setting state to", getStateDescription(newState))
        this.state = newState
    }
}

export function tokenizeString(parser: IParser, onerror: (message: string, range: Range) => void, str: string, opt?: TokenizerOptions) {
    const tok = new Tokenizer(parser, onerror, opt)
    tok.write(
        str,
        {
            pause: () => {
                //
            },
            continue: () => {
                //
            },
        }
    )
    tok.end()
}
export function tokenizeStrings(parser: IParser, onerror: (message: string, range: Range) => void, strings: string[], opt?: TokenizerOptions) {
    const tok = new Tokenizer(parser, onerror, opt)
    strings.forEach(str => {
        tok.write(
            str,
            {
                pause: () => {
                    //
                },
                continue: () => {
                    //
                },
            }
        )
    })
    tok.end()
}