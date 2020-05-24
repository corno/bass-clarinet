/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/

import * as papi from "pareto-api"
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
import { ITokenStreamConsumer, TokenStreamConsumerDataType, TokenStreamConsumerData, OnDataReturnValue } from "./ITokenStreamConsumer"

const DEBUG = false

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

function getStateDescription(stackContext: CurrentToken | null): string {
    if (stackContext === null) {
        return "NONE"
    }
    switch (stackContext[0]) {
        case TokenType.COMMENT: return "COMMENT"
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
    lookahead(): number | null {
        const char = this.chunk.charCodeAt(this.index + 1)
        return isNaN(char) ? null : char
    }
}

type QueueEntry =
    | [false, ProcessingData] //end not reached
    | [true, {
        aborted: boolean
    }] //end reached

class Tokenizer {
    private readonly onerror: (message: string, range: Range) => void

    private currentChunk: null | ProcessingData = null
    private ended = false

    public readonly opt: TokenizerOptions
    private readonly queue: QueueEntry[] = []

    // mostly just for error reporting
    private position = -1
    private column = 0
    private line = 1

    private currentTokenType: CurrentToken | null

    private readonly tokenStreamConsumer: ITokenStreamConsumer

    constructor(tokenStreamConsumer: ITokenStreamConsumer, onerror: (message: string, range: Range) => void, opt?: TokenizerOptions) {
        this.opt = opt || {}
        this.tokenStreamConsumer = tokenStreamConsumer
        this.currentTokenType = null
        this.onerror = onerror
    }
    public onData(chunk: string): OnDataReturnValue {
        if (this.ended) {
            throw new Error("cannot write, stream is ended")
        }
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
        if (this.currentChunk === null) {
            this.currentChunk = new ProcessingData(chunk)
            this.writeImp(this.currentChunk)
            this.emptyQueue()
        } else {
            this.queue.push([false, new ProcessingData(chunk)])
        }
        return false
    }
    private emptyQueue() {
        while (this.currentChunk === null) {
            const nextChunk = this.queue.shift()
            if (nextChunk !== undefined) {
                if (nextChunk[0]) { //end reached
                    this.onEnd(nextChunk[1].aborted)
                } else {
                    this.writeImp(new ProcessingData(nextChunk[1].chunk))
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

            const ccAsString = cc === null ? "" : `${cc}`
            console.log(
                `${stateInfo.padEnd(35)}${JSON.stringify(char).padStart(4)} ${(`(${ccAsString})`).padEnd(5)}` +
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
        const onData = (data: TokenStreamConsumerData) => {
            const onDataReturnValue = this.tokenStreamConsumer.onData(data)
            if (typeof onDataReturnValue === "boolean") {
                //FIXME
            } else {
                onDataReturnValue.handleSafePromise(_abortRequested => {
                    /**
                     * I need to remove the while(true) loops and replace them with a nested call
                     */
                    throw new Error("IMPLEMENT ME")
                })
            }
        }
        const onSnippet = (chunk: string, begin: number, end: number) => {
            onData({
                type: [TokenStreamConsumerDataType.Snippet, {
                    chunk: chunk,
                    begin: begin,
                    end: end,
                }],
            })
        }
        // const pauser: Pauser = {
        //     pause: () => {
        //         currentChunk.mustPause = true
        //         currentChunk.sourcePauser.pause()
        //     },
        //     continue: () => {
        //         currentChunk.mustPause = false
        //         if (this.currentChunk !== null) {
        //             this.writeImp(this.currentChunk)
        //         }
        //         this.emptyQueue()
        //         currentChunk.sourcePauser.continue()
        //     },
        // }
        const processUntilFirstNotIncludedCharacter = (
            isIncludedCharacter: (char: number) => boolean,
            onEndOfToken: () => void,
        ): boolean => {
            let snippetStart: null | number = null
            const flush = () => {
                if (snippetStart !== null) {
                    onSnippet(currentChunk.chunk, snippetStart, currentChunk.index + 1)

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
                    return true
                }

                //first check if we are breaking out of an unquoted token. Can only be done by checking the character that comes directly after the unquoted token
                if (!isIncludedCharacter(nextChar)) {
                    flush()
                    onEndOfToken()

                    this.setCurrentTokenType(null)
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
            return false
        }

        while (true) {
            const state = this.currentTokenType
            if (state === null) {
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

                    onData({
                        type: [TokenStreamConsumerDataType.WhiteSpaceBegin, {
                            location: this.getBeginLocation(),
                        }],
                    })
                    onSnippet(currentChunk.chunk, currentChunk.index, currentChunk.index + 1) //copy current character
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
                        onData({
                            type: [TokenStreamConsumerDataType.QuotedStringBegin, {
                                quote: String.fromCharCode(currentChar),
                                range: { start: this.getBeginLocation(), end: this.getEndLocation() },
                            }],
                        })
                        if (currentChunk.mustPause) {
                            return
                        }
                    } else {
                        this.setCurrentTokenType([TokenType.UNQUOTED_TOKEN])
                        onData({
                            type: [TokenStreamConsumerDataType.UnquotedTokenBegin, {
                                location: this.getBeginLocation(),
                            }],
                        })
                        if (currentChunk.mustPause) {
                            return
                        }
                        onSnippet(currentChunk.chunk, currentChunk.index, currentChunk.index + 1) //copy current character
                        if (currentChunk.mustPause) {
                            return
                        }

                    }
                } else {
                    onData({
                        type: [TokenStreamConsumerDataType.Punctuation, {
                            range: {
                                start: this.getBeginLocation(),
                                end: this.getEndLocation(),
                            },
                            char: currentChar,
                        }],
                    })
                    if (currentChunk.mustPause) {
                        return
                    }
                }

            } else {
                switch (state[0]) {
                    case TokenType.COMMENT: {
                        /**
                         * COMMENT
                         */
                        const $ = state[1]

                        let snippetStart: null | number = null
                        const flush = (offset?: number) => {
                            if (snippetStart !== null) {
                                onSnippet(currentChunk.chunk, snippetStart, currentChunk.index + (offset === undefined ? 0 : offset))
                                if (currentChunk.mustPause) {
                                    return
                                }
                            }
                            snippetStart = null
                        }

                        switch ($.state[0]) {
                            case CommentState.BLOCK_COMMENT: {
                                blockCommentLoop: while (true) {
                                    //if (DEBUG) console.log(currentChunk.index, currentChar, String.fromCharCode(currentChar), 'string loop', $.slashed, $.textNode)
                                    const nextChar = currentChunk.lookahead()


                                    if (nextChar === null) {
                                        //end of the chunk
                                        //store it and wait for more input
                                        flush()
                                        return
                                    }
                                    const $$ = $.state[1]

                                    //whatever character is next, it is part of the block comment, so consume it

                                    this.next(currentChunk)

                                    if (snippetStart === null) {
                                        snippetStart = currentChunk.index
                                    }
                                    if ($$.foundAsterisk === null) {
                                        if (nextChar === Char.Comment.asterisk) {
                                            $$.foundAsterisk = this.getBeginLocation()
                                            //possible end of comment
                                            flush()
                                        }
                                    } else {
                                        if (nextChar === Char.Comment.solidus) {
                                            //end of block comment
                                            this.setCurrentTokenType(null)
                                            onData({
                                                type: [TokenStreamConsumerDataType.BlockCommentEnd, {
                                                    range: { start: $$.foundAsterisk, end: this.getEndLocation() },
                                                }],
                                            })

                                            if (currentChunk.mustPause) {
                                                return
                                            }
                                            break blockCommentLoop
                                        } else {
                                            //false alarm, not the end of the comment
                                            onSnippet("*", 0, 1)

                                            if (currentChunk.mustPause) {
                                                return
                                            }
                                            if (snippetStart === null) {
                                                snippetStart = currentChunk.index
                                            }
                                            $$.foundAsterisk = null
                                        }

                                    }
                                }
                                break
                            }
                            case CommentState.LINE_COMMENT: {
                                const mustBreak = processUntilFirstNotIncludedCharacter(
                                    char => {
                                        return char !== Char.Whitespace.lineFeed &&
                                            char !== Char.Whitespace.carriageReturn
                                    },
                                    () => {
                                        onData({
                                            type: [TokenStreamConsumerDataType.LineCommentEnd, {
                                                location: this.getEndLocation(),
                                            }],
                                        })
                                    }
                                )
                                if (mustBreak) {
                                    return
                                }
                                break
                            }
                            case CommentState.FOUND_SOLIDUS: {
                                const $$ = $.state[1]
                                const nextChar = currentChunk.lookahead()
                                if (nextChar === null) {
                                    return
                                }

                                if (nextChar === Char.Comment.solidus) {
                                    this.next(currentChunk)

                                    onData({
                                        type: [TokenStreamConsumerDataType.LineCommentBegin, {
                                            range: { start: $$.start, end: this.getEndLocation() },
                                        }],
                                    })

                                    if (currentChunk.mustPause) {
                                        return
                                    }
                                    $.state = [CommentState.LINE_COMMENT]
                                } else if (nextChar === Char.Comment.asterisk) {
                                    this.next(currentChunk)

                                    onData({
                                        type: [TokenStreamConsumerDataType.BlockCommentBegin, {
                                            range: { start: $$.start, end: this.getEndLocation() },
                                        }],
                                    })

                                    if (currentChunk.mustPause) {
                                        return
                                    }
                                    $.state = [CommentState.BLOCK_COMMENT, { foundAsterisk: null }]
                                } else {
                                    this.raiseError("found dangling slash", { start: this.getBeginLocation(), end: this.getEndLocation() })
                                    this.setCurrentTokenType(null)
                                }
                                break
                            }
                            default:
                                assertUnreachable($.state)

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
                                assertUnreachable($.foundNewLineCharacter)
                        }
                        onData({
                            type: [TokenStreamConsumerDataType.NewLine, {
                                range: { start: $.startLocation, end: this.getEndLocation() },
                            }],
                        })
                        this.setCurrentTokenType(null)
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
                                onSnippet(currentChunk.chunk, snippetStart, currentChunk.index)
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
                                    onSnippet(str, 0, str.length)
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
                                    onSnippet(textNode, 0, textNode.length)
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
                                    const rangeInfo = {
                                        start: this.getBeginLocation(),
                                        end: this.getEndLocation(),
                                    }
                                    this.setCurrentTokenType(null)

                                    onData({
                                        type: [TokenStreamConsumerDataType.QuotedStringEnd, {
                                            range: rangeInfo,
                                            quote: String.fromCharCode(currentChar),
                                        }],
                                    })
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
                        const mustBreak = processUntilFirstNotIncludedCharacter(
                            (char: number) => {
                                const isOtherCharacter = (false
                                    || char === Char.Whitespace.carriageReturn
                                    || char === Char.Whitespace.lineFeed
                                    || char === Char.Whitespace.space
                                    || char === Char.Whitespace.tab

                                    || char === Char.Punctuation.closeBrace
                                    || char === Char.Punctuation.closeParen
                                    || char === Char.Punctuation.colon
                                    || char === Char.Punctuation.comma
                                    || char === Char.Punctuation.openBrace
                                    || char === Char.Punctuation.openParen
                                    || char === Char.Punctuation.closeAngleBracket
                                    || char === Char.Punctuation.closeBracket
                                    || char === Char.Punctuation.openAngleBracket
                                    || char === Char.Punctuation.openBracket
                                    || char === Char.Punctuation.verticalLine
                                    || char === Char.Punctuation.hash

                                    || char === Char.Comment.solidus

                                    || char === Char.QuotedString.quotationMark
                                    || char === Char.QuotedString.apostrophe
                                )
                                return !isOtherCharacter
                            },
                            () => {

                                onData({
                                    type: [TokenStreamConsumerDataType.UnquotedTokenEnd, {
                                        location: this.getEndLocation(),
                                    }],
                                })
                            },
                        )
                        if (mustBreak) {
                            return
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
                                onSnippet(currentChunk.chunk, snippetStart, currentChunk.index + 1)

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

                                onData({
                                    type: [TokenStreamConsumerDataType.WhiteSpaceEnd, {
                                        location: this.getEndLocation(),
                                    }],
                                })

                                this.setCurrentTokenType(null)
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
    }
    public end(aborted: boolean): void {
        if (this.ended) {
            throw new Error("cannot end, already ended")
        }
        if (this.currentChunk !== null) {
            this.queue.push([true, {
                aborted: aborted,
            }])
        } else {
            this.onEnd(aborted)
        }
    }
    private onEnd(aborted: boolean) {
        const onData = (data: TokenStreamConsumerData) => {
            const onDataReturnValue = this.tokenStreamConsumer.onData(data)
            if (typeof onDataReturnValue === "boolean") {
                //nothing to abort anymore
            } else {
                onDataReturnValue.handleSafePromise(_abort => {
                    //nothing to abort anymore
                })
            }
        }
        if (this.currentTokenType !== null) {
            switch (this.currentTokenType[0]) {
                case TokenType.COMMENT: {
                    const $ = this.currentTokenType[1]
                    switch ($.state[0]) {
                        case CommentState.BLOCK_COMMENT: {
                            this.raiseError("unterminated block comment", { start: this.getEndLocation(), end: this.getEndLocation() })
                            onData({
                                type: [TokenStreamConsumerDataType.BlockCommentEnd, {
                                    range: {
                                        start: this.getEndLocation(),
                                        end: this.getEndLocation(),
                                    },
                                }],
                            })
                            break
                        }
                        case CommentState.LINE_COMMENT: {
                            onData({
                                type: [TokenStreamConsumerDataType.LineCommentEnd, {
                                    location: this.getEndLocation(),
                                }],
                            })
                            break
                        }
                        case CommentState.FOUND_SOLIDUS: {
                            this.raiseError("found dangling slash at the end of the document", { start: this.getBeginLocation(), end: this.getEndLocation() })
                            break
                        }
                        default:
                            assertUnreachable($.state[0])
                    }
                    break
                }
                case TokenType.NEWLINE:
                    const $ = this.currentTokenType[1]
                    onData({
                        type: [TokenStreamConsumerDataType.NewLine, {
                            range: { start: $.startLocation, end: this.getEndLocation() },
                        }],
                    })
                    break
                case TokenType.QUOTED_STRING: {
                    this.raiseError("unterminated string", { start: this.getEndLocation(), end: this.getEndLocation() })

                    onData({
                        type: [TokenStreamConsumerDataType.QuotedStringEnd, {
                            range: {
                                start: this.getEndLocation(),
                                end: this.getEndLocation(),
                            },
                            quote: null,
                        }],
                    })
                    break
                }
                case TokenType.UNQUOTED_TOKEN:
                    onData({
                        type: [TokenStreamConsumerDataType.UnquotedTokenEnd, {
                            location: this.getEndLocation(),
                        }],
                    })
                    break
                case TokenType.WHITESPACE:
                    onData({
                        type: [TokenStreamConsumerDataType.WhiteSpaceEnd, {
                            location: this.getEndLocation(),
                        }],
                    })
                    break
                default:
                    return assertUnreachable(this.currentTokenType[0])
            }
            this.setCurrentTokenType(null)
        }
        this.tokenStreamConsumer.onEnd(aborted, this.getEndLocation())

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
    private setCurrentTokenType(tokenType: CurrentToken | null) {
        if (DEBUG) console.log("setting state to", getStateDescription(tokenType))
        this.currentTokenType = tokenType
    }
}

export function tokenizeStream(
    stream: papi.IStream<string, null>,
    tokenStreamConsumer: ITokenStreamConsumer,
    onerror: (message: string, range: Range) => void,
    opt?: TokenizerOptions
): void {
    const tok = new Tokenizer(tokenStreamConsumer, onerror, opt)
    stream.processStream(
        null,
        chunk => {
            return tok.onData(chunk)
        },
        aborted => {
            tok.end(aborted)
        }
    )
}