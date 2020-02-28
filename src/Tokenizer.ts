/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/

import * as Char from "./Characters"
import {
    TokenType,
    CurrentToken,
    CommentState,
    SimpleValueType,
    FoundNewLineCharacter,
} from "./tokenizerStateTypes"
import { Location, Range } from "./location"
import { TokenizerOptions } from "./configurationTypes"
import { IParser, Pauser } from "./parserAPI"

const DEBUG = false

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

function getStateDescription(stackContext: CurrentToken): string {
    switch (stackContext[0]) {
        case TokenType.COMMENT: return "COMMENT"
        case TokenType.NONE: return "NONE"
        case TokenType.NEWLINE: return "NEWLINE"
        case TokenType.QUOTED_STRING: return "QUOTED_STRING"
        case TokenType.UNQUOTED_TOKEN: return "UNQUOTED_STRING"
        case TokenType.WHITESPACE: return "WHITESPACE"
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

    private currentTokenType: CurrentToken

    private readonly parser: IParser

    constructor(parser: IParser, onerror: (message: string, range: Range) => void, opt?: TokenizerOptions) {
        this.opt = opt || {}
        this.parser = parser
        this.currentTokenType = [TokenType.NONE, { virginLine: true }]
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
            const nextChunk = this.queue.shift()
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
            const stateInfo = getStateDescription(this.currentTokenType)
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
            const state = this.currentTokenType
            switch (state[0]) {
                case TokenType.COMMENT: {
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
                                    this.setCurrentTokenType([TokenType.NONE, { virginLine: true }])
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
                                    this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])
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
                                    this.parser.onBlockCommentBegin({ start: $$.start, end: this.getEndLocation() }, pauser)

                                    if (currentChunk.mustPause) {
                                        return
                                    }
                                    $.state = [CommentState.BLOCK_COMMENT]
                                } else {
                                    this.raiseError("found dangling slash", { start: this.getBeginLocation(), end: this.getEndLocation() })
                                    this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])

                                }
                                break
                            }
                            default: assertUnreachable($.state)
                        }
                    }

                    break
                }
                case TokenType.NEWLINE: {
                    const nextChar = currentChunk.lookahead()
                    const $ = state[1]
                    switch ($.foundNewLineCharacter) {
                        case FoundNewLineCharacter.CARRIAGE_RETURN: {
                            if (nextChar === Char.Whitespace.lineFeed) {
                                //windows style newlines (\r\n)
                                this.next(currentChunk)
                            } else {
                                //old style Mac OS newlines (\r)
                                //don't consume character
                            }
                            break
                        }
                        case FoundNewLineCharacter.LINE_FEED: {
                            if (nextChar === Char.Whitespace.carriageReturn) {
                                //strange style newline (\n\r)
                                this.next(currentChunk)
                            } else {
                                //unix style newlines (\n)
                                //don't consume character
                            }
                            break
                        }
                        default:
                            return assertUnreachable($.foundNewLineCharacter)
                    }
                    this.parser.onNewLine({ start: $.startLocation, end: this.getEndLocation() })
                    this.setCurrentTokenType([TokenType.NONE, { virginLine: true }])
                    break
                }
                case TokenType.NONE: {
                    const $ = state[1]
                    const currentChar = this.next(currentChunk)

                    if (currentChar === Char.Whitespace.carriageReturn) {
                        this.setCurrentTokenType([TokenType.NEWLINE, { foundNewLineCharacter: FoundNewLineCharacter.CARRIAGE_RETURN, startLocation: this.getBeginLocation() }])
                        continue
                    }

                    if (currentChar === Char.Whitespace.lineFeed) {
                        this.setCurrentTokenType([TokenType.NEWLINE, { foundNewLineCharacter: FoundNewLineCharacter.LINE_FEED, startLocation: this.getBeginLocation() }])
                        continue
                    }
                    if (
                        currentChar === Char.Whitespace.space ||
                        currentChar === Char.Whitespace.tab
                    ) {
                        this.parser.onWhitespaceBegin(this.getBeginLocation(), $.virginLine)
                        this.parser.onSnippet(currentChunk.chunk, currentChunk.index, currentChunk.index + 1, pauser) //copy current character
                        this.setCurrentTokenType([TokenType.WHITESPACE])
                        continue
                    }
                    if (currentChar === null) {
                        //end of chunk reached
                        return
                    }
                    function getSimpleValueType(): SimpleValueType | null {
                        if (currentChar === Char.QuotedString.quotationMark || currentChar === Char.QuotedString.apostrophe) {
                            return SimpleValueType.QUOTED_STRING
                        } else {
                            if (
                                currentChar === Char.Punctuation.openBracket ||
                                currentChar === Char.Punctuation.openAngleBracket ||
                                currentChar === Char.Punctuation.comma ||
                                currentChar === Char.Punctuation.closeBracket ||
                                currentChar === Char.Punctuation.closeAngleBracket ||
                                currentChar === Char.Punctuation.openBrace ||
                                currentChar === Char.Punctuation.openParen ||
                                currentChar === Char.Punctuation.closeParen ||
                                currentChar === Char.Punctuation.closeBrace ||
                                currentChar === Char.Punctuation.colon ||
                                currentChar === Char.Punctuation.exclamationMark ||
                                currentChar === Char.Punctuation.hash ||
                                currentChar === Char.Punctuation.verticalLine
                            ) {
                                return null
                            }
                            return SimpleValueType.UNQUOTED_STRING
                        }
                    }
                    const valueType = getSimpleValueType()
                    if (currentChar === Char.Comment.solidus) {
                        this.setCurrentTokenType([TokenType.COMMENT, {
                            state: [CommentState.FOUND_SOLIDUS, { start: this.getBeginLocation() }],
                        }])
                    } else if (valueType !== null) {
                        if (valueType === SimpleValueType.QUOTED_STRING) {
                            this.setCurrentTokenType([TokenType.QUOTED_STRING, {
                                startCharacter: currentChar,
                                slashed: false,
                                unicode: null,
                            }])
                            this.parser.onQuotedStringBegin({ start: this.getBeginLocation(), end: this.getEndLocation() }, String.fromCharCode(currentChar), pauser)
                            if (currentChunk.mustPause) {
                                return
                            }
                        } else {
                            this.setCurrentTokenType([TokenType.UNQUOTED_TOKEN])
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
                case TokenType.QUOTED_STRING: {
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
                                this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])
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
                case TokenType.UNQUOTED_TOKEN: {
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

                                || nextChar === Char.Punctuation.closeBrace
                                || nextChar === Char.Punctuation.closeParen
                                || nextChar === Char.Punctuation.colon
                                || nextChar === Char.Punctuation.comma
                                || nextChar === Char.Punctuation.openBrace
                                || nextChar === Char.Punctuation.openParen
                                || nextChar === Char.Punctuation.closeAngleBracket
                                || nextChar === Char.Punctuation.closeBracket
                                || nextChar === Char.Punctuation.openAngleBracket
                                || nextChar === Char.Punctuation.openBracket
                                || nextChar === Char.Punctuation.verticalLine
                                || nextChar === Char.Punctuation.hash

                                || nextChar === Char.Comment.solidus

                                || nextChar === Char.QuotedString.quotationMark
                                || nextChar === Char.QuotedString.apostrophe
                            )
                            return !isOtherCharacter
                        }
                        //first check if we are breaking out of an unquoted token. Can only be done by checking the character that comes directly after the unquoted token
                        if (!isUnquotedTokenCharacter()) {
                            flush()

                            this.parser.onUnquotedTokenEnd(this.getEndLocation(), pauser)

                            this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])
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
                case TokenType.WHITESPACE: {
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

                        function isWhiteSpaceCharacter() {
                            return (nextChar === Char.Whitespace.space || nextChar === Char.Whitespace.tab)
                        }
                        //first check if we are breaking out of an whitespace token. Can only be done by checking the character that comes directly after the whitespace token
                        if (!isWhiteSpaceCharacter()) {
                            flush()

                            this.parser.onWhitespaceEnd(this.getEndLocation())

                            this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])
                            //this character does not belong to the whitespace so don't go to the next character by breaking
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
        switch (this.currentTokenType[0]) {
            case TokenType.COMMENT: {
                const $ = this.currentTokenType[1]
                if ($.state[0] === CommentState.BLOCK_COMMENT) {
                    this.raiseError("unterminated block comment", { start: this.getEndLocation(), end: this.getEndLocation() })
                    const locationInfo = {
                        start: this.getEndLocation(),
                        end: this.getEndLocation(),
                    }
                    this.parser.onBlockCommentEnd(locationInfo, null)
                    this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])
                }
                break
            }
            case TokenType.NEWLINE:
                const $ = this.currentTokenType[1]
                this.parser.onNewLine({ start: $.startLocation, end: this.getEndLocation() })
                break
            case TokenType.NONE:
                break
            case TokenType.QUOTED_STRING: {
                this.raiseError("unterminated string", { start: this.getEndLocation(), end: this.getEndLocation() })

                const locationInfo = {
                    start: this.getEndLocation(),
                    end: this.getEndLocation(),
                }
                this.parser.onQuotedStringEnd(locationInfo, null, null)
                this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])
                break
            }
            case TokenType.UNQUOTED_TOKEN:
                this.parser.onUnquotedTokenEnd(this.getEndLocation(), null)

                this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])

                break
            case TokenType.WHITESPACE:
                this.parser.onWhitespaceEnd(this.getEndLocation())

                this.setCurrentTokenType([TokenType.NONE, { virginLine: false }])

                break
            default:
                return assertUnreachable(this.currentTokenType[0])
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
    private setCurrentTokenType(tokenType: CurrentToken) {
        if (DEBUG) console.log("setting state to", getStateDescription(tokenType))
        this.currentTokenType = tokenType
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