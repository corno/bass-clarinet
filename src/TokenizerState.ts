/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/
import * as Char from "./Characters"
import {
    TokenType,
    CurrentToken,
    FoundCharacterType,
} from "./tokenizerStateTypes"
import { Location, Range } from "./location"
import { TokenDataType, TokenData } from "./TokenData"


export type TokenizerOptions = {
    spaces_per_tab?: number //eslint-disable-line
}

const DEBUG = false

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

function getStateDescription(stackContext: CurrentToken | null): string {
    if (stackContext === null) {
        return "NONE"
    }
    switch (stackContext[0]) {
        case TokenType.BLOCK_COMMENT: return "BLOCK_COMMENT"
        case TokenType.LINE_COMMENT: return "LINE_COMMENT"
        case TokenType.NONE: return "NONE"
        case TokenType.QUOTED_STRING: return "QUOTED_STRING"
        case TokenType.UNQUOTED_TOKEN: return "UNQUOTED_STRING"
        case TokenType.WHITESPACE: return "WHITESPACE"
        default: return assertUnreachable(stackContext[0])

    }
}

export class Chunk {
    public currentIndex: number
    public str: string
    constructor(str: string){
        this.str = str
        this.currentIndex = -1
    }
    lookahead(): number | null {
        const char = this.str.charCodeAt(this.currentIndex + 1)
        return isNaN(char) ? null : char
    }
}

export class TokenizerState {
    public atEnd = false
    private readonly location = {
        position: -1,
        column: 0,
        line: 1,
    }
    private readonly opt: TokenizerOptions
    public currentTokenType: CurrentToken
    private readonly onerror: (message: string, range: Range) => void

    constructor(
        options: TokenizerOptions,
        onerror: (message: string, range: Range) => void
    ) {
        this.opt = options
        //start at the position just before the first character
        //because we are going to call currentChar = next() once at the beginning
        this.currentTokenType = [TokenType.NONE, { foundCharacter: null }]
        this.onerror = onerror
    }
    private raiseError(message: string, range: Range) {
        if (DEBUG) { console.log("error raised:", message) }
        this.onerror(message, range)
    }
    private setCurrentTokenType(tokenType: CurrentToken) {
        if (DEBUG) console.log("setting state to", getStateDescription(tokenType))
        this.currentTokenType = tokenType
    }
    // setCurrentChunk(chunk: string) {
    //     this.currentChunk = chunk
    //     this.currentIndex = -1
    // }
    public getNextLocation(): Location {
        return {
            position: this.location.position + 1,
            line: this.location.line,
            column: this.location.column + 1,
        }
    }
    public getCurrentLocation(): Location {
        return {
            position: this.location.position,
            line: this.location.line,
            column: this.location.column,
        }
    }
    consumeNextChar(chunk: Chunk): void {
        const cc = chunk.lookahead()

        // if (DEBUG) {
        //     const stateInfo = getStateDescription(this.currentTokenType)
        //     const char = (cc === Char.Whitespace.tab) ? "\\t" : cc === null ? "\\0" : String.fromCharCode(cc)

        //     const ccAsString = cc === null ? "" : `${cc}`
        //     console.log(
        //         `${stateInfo.padEnd(35)}${JSON.stringify(char).padStart(4)} ${(`(${ccAsString})`).padEnd(5)}` +
        //         ` ${this.location.line.toString().padStart(4)}:${this.location.column.toString().padEnd(3)}(${this.location.position})`,
        //         this.index
        //     )
        // }
        if (cc === null) {
            this.atEnd = true
        } else {
            this.location.position++
            //set the position
            switch (cc) {
                case Char.Whitespace.lineFeed:
                    this.location.line++
                    this.location.column = 0
                    break
                case Char.Whitespace.carriageReturn:
                    break
                case Char.Whitespace.tab:
                    const tab = (this.opt.spaces_per_tab) ? this.opt.spaces_per_tab : 4
                    this.location.column += tab
                    break
                default:
                    this.location.column++
            }
        }
        chunk.currentIndex++
    }
    public handleDanglingToken (): TokenData | null {
        const ct = this.currentTokenType
        switch (ct[0]) {
            case TokenType.BLOCK_COMMENT: {
                this.raiseError("unterminated block comment", { start: this.getNextLocation(), end: this.getNextLocation() })
                return {
                    type: [TokenDataType.BlockCommentEnd, {
                        range: {
                            start: this.getNextLocation(),
                            end: this.getNextLocation(),
                        },
                    }],
                }
            }
            case TokenType.LINE_COMMENT: {
                return {
                    type: [TokenDataType.LineCommentEnd, {
                        location: this.getNextLocation(),
                    }],
                }
            }
            case TokenType.NONE:
                const $ = ct[1]
                if ($.foundCharacter !== null) {
                    if ($.foundCharacter.type === FoundCharacterType.SOLIDUS) {
                        this.raiseError("found dangling slash at the end of the document", { start: this.getCurrentLocation(), end: this.getNextLocation() })
                        return null
                    }
                    return {
                        type: [TokenDataType.NewLine, {
                            range: { start: $.foundCharacter.startLocation, end: this.getNextLocation() },
                        }],
                    }
                } else {
                    return null
                }
            case TokenType.QUOTED_STRING: {
                this.raiseError("unterminated string", { start: this.getNextLocation(), end: this.getNextLocation() })

                return {
                    type: [TokenDataType.QuotedStringEnd, {
                        range: {
                            start: this.getNextLocation(),
                            end: this.getNextLocation(),
                        },
                        quote: null,
                    }],
                }
            }
            case TokenType.UNQUOTED_TOKEN:
                return {
                    type: [TokenDataType.UnquotedTokenEnd, {
                        location: this.getNextLocation(),
                    }],
                }
            case TokenType.WHITESPACE:
                return {
                    type: [TokenDataType.WhiteSpaceEnd, {
                        location: this.getNextLocation(),
                    }],
                }
            default:
                return assertUnreachable(ct[0])
        }
    }
    public createNextToken(currentChunk: Chunk): null | TokenData {
        const onSnippet2 = (chunkString: string, begin: number, end: number): TokenData => {
            return {
                type: [TokenDataType.Snippet, {
                    chunk: chunkString,
                    begin: begin,
                    end: end,
                }],
            }
        }
        const processUntilFirstNotIncludedCharacter = (
            isIncludedCharacter: (char: number) => boolean,
            onEndOfToken: () => TokenData,
        ): null | TokenData => {
            let snippetStart: null | number = null

            while (true) {
                const nextChar = currentChunk.lookahead()
                if (nextChar === null) {

                    if (snippetStart !== null) {
                        return onSnippet2(currentChunk.str, snippetStart, currentChunk.currentIndex + 1)
                    }
                    return null
                }

                //first check if we are breaking out of an unquoted token. Can only be done by checking the character that comes directly after the unquoted token
                if (!isIncludedCharacter(nextChar)) {

                    if (snippetStart !== null) {
                        return onSnippet2(currentChunk.str, snippetStart, currentChunk.currentIndex + 1)
                    }
                    this.setCurrentTokenType([TokenType.NONE, { foundCharacter: null }])
                    return onEndOfToken()

                    //this character does not belong to the keyword so don't go to the next character by breaking
                } else {
                    //normal character
                    //don't flush
                    this.consumeNextChar(currentChunk)
                    if (snippetStart === null) {
                        snippetStart = currentChunk.currentIndex
                    }
                }
            }
        }
        const currentTokenType = this.currentTokenType
        switch (currentTokenType[0]) {
            case TokenType.BLOCK_COMMENT: {
                const $$ = currentTokenType[1]
                let snippetStart: null | number = null

                while (true) {

                    //if (DEBUG) console.log(currentChunk.index, currentChar, String.fromCharCode(currentChar), 'string loop', $.slashed, $.textNode)
                    const nextChar = currentChunk.lookahead()


                    if (nextChar === null) {
                        //end of the chunk
                        //store it and wait for more input
                        if (snippetStart !== null) {
                            const ss = snippetStart
                            return onSnippet2(currentChunk.str, ss, currentChunk.currentIndex)
                        }
                        return null
                    }

                    //whatever character is next, it is part of the block comment, so consume it

                    this.consumeNextChar(currentChunk)

                    if (snippetStart === null) {
                        snippetStart = currentChunk.currentIndex
                    }
                    if ($$.foundAsterisk === null) {
                        if (nextChar === Char.Comment.asterisk) {
                            $$.foundAsterisk = this.getCurrentLocation()
                            //possible end of comment

                            //is this needed?
                            if (snippetStart !== null) {
                                const ss = snippetStart
                                snippetStart = null
                                return onSnippet2(currentChunk.str, ss, currentChunk.currentIndex)
                            }
                        }
                    } else {
                        if (nextChar === Char.Comment.solidus) {
                            //end of block comment
                            this.setCurrentTokenType([TokenType.NONE, { foundCharacter: null }])
                            return {
                                type: [TokenDataType.BlockCommentEnd, {
                                    range: { start: $$.foundAsterisk, end: this.getNextLocation() },
                                }],
                            }
                        } else {
                            //false alarm, not the end of the comment

                            if (snippetStart === null) {
                                snippetStart = currentChunk.currentIndex
                            }
                            $$.foundAsterisk = null
                            return onSnippet2("*", 0, 1)
                        }

                    }
                }
            }
            case TokenType.LINE_COMMENT: {

                return processUntilFirstNotIncludedCharacter(
                    char => {
                        return char !== Char.Whitespace.lineFeed &&
                            char !== Char.Whitespace.carriageReturn
                    },
                    () => {
                        return {
                            type: [TokenDataType.LineCommentEnd, {
                                location: this.getNextLocation(),
                            }],
                        }
                    }
                )
            }
            case TokenType.NONE: {
                while (true) {
                    const nextChar = currentChunk.lookahead()
                    if (nextChar === null) {
                        //end of chunk reached
                        return null
                    }
                    const $ = currentTokenType[1]
                    if ($.foundCharacter === null) {

                        switch (nextChar) {
                            case Char.Whitespace.carriageReturn: {
                                this.consumeNextChar(currentChunk)

                                $.foundCharacter = {
                                    type: FoundCharacterType.CARRIAGE_RETURN,
                                    startLocation: this.getCurrentLocation(),
                                }
                                break
                            }
                            case Char.Whitespace.lineFeed: {
                                this.consumeNextChar(currentChunk)

                                $.foundCharacter = {
                                    type: FoundCharacterType.LINE_FEED,
                                    startLocation: this.getCurrentLocation(),
                                }
                                break
                            }
                            case Char.Whitespace.space: {
                                this.setCurrentTokenType([TokenType.WHITESPACE])
                                return {
                                    type: [TokenDataType.WhiteSpaceBegin, {
                                        location: this.getNextLocation(),
                                    }],
                                }
                            }
                            case Char.Comment.solidus: {
                                this.consumeNextChar(currentChunk)
                                $.foundCharacter = {
                                    type: FoundCharacterType.SOLIDUS,
                                    startLocation: this.getCurrentLocation(),
                                }
                                break
                            }
                            case Char.Whitespace.tab: {
                                this.setCurrentTokenType([TokenType.WHITESPACE])
                                return {
                                    type: [TokenDataType.WhiteSpaceBegin, {
                                        location: this.getCurrentLocation(),
                                    }],
                                }
                            }
                            case Char.QuotedString.apostrophe: {
                                this.consumeNextChar(currentChunk)
                                this.setCurrentTokenType([TokenType.QUOTED_STRING, {
                                    startCharacter: nextChar,
                                    slashed: false,
                                    unicode: null,
                                }])
                                return {
                                    type: [TokenDataType.QuotedStringBegin, {
                                        quote: String.fromCharCode(nextChar),
                                        range: { start: this.getCurrentLocation(), end: this.getNextLocation() },
                                    }],
                                }
                            }
                            case Char.QuotedString.quotationMark: {
                                this.consumeNextChar(currentChunk)
                                this.setCurrentTokenType([TokenType.QUOTED_STRING, {
                                    startCharacter: nextChar,
                                    slashed: false,
                                    unicode: null,
                                }])
                                return {
                                    type: [TokenDataType.QuotedStringBegin, {
                                        quote: String.fromCharCode(nextChar),
                                        range: { start: this.getCurrentLocation(), end: this.getNextLocation() },
                                    }],
                                }
                            }
                            default: {
                                function nextIsPunctuation(): boolean {
                                    if (
                                        nextChar === Char.Punctuation.openBracket ||
                                        nextChar === Char.Punctuation.openAngleBracket ||
                                        nextChar === Char.Punctuation.comma ||
                                        nextChar === Char.Punctuation.closeBracket ||
                                        nextChar === Char.Punctuation.closeAngleBracket ||
                                        nextChar === Char.Punctuation.openBrace ||
                                        nextChar === Char.Punctuation.openParen ||
                                        nextChar === Char.Punctuation.closeParen ||
                                        nextChar === Char.Punctuation.closeBrace ||
                                        nextChar === Char.Punctuation.colon ||
                                        nextChar === Char.Punctuation.exclamationMark ||
                                        nextChar === Char.Punctuation.hash ||
                                        nextChar === Char.Punctuation.verticalLine
                                    ) {
                                        return true
                                    }
                                    return false
                                }
                                const nip = nextIsPunctuation()
                                if (!nip) {
                                    this.setCurrentTokenType([TokenType.UNQUOTED_TOKEN])
                                    return {
                                        type: [TokenDataType.UnquotedTokenBegin, {
                                            location: this.getNextLocation(),
                                        }],
                                    }
                                } else {
                                    this.consumeNextChar(currentChunk)
                                    return {
                                        type: [TokenDataType.Punctuation, {
                                            range: {
                                                start: this.getCurrentLocation(),
                                                end: this.getNextLocation(),
                                            },
                                            char: nextChar,
                                        }],
                                    }
                                }

                            }
                        }
                    } else {
                        switch ($.foundCharacter.type) {
                            case FoundCharacterType.CARRIAGE_RETURN: {
                                if (nextChar === Char.Whitespace.lineFeed) {
                                    //windows style newlines (\r\n)
                                    this.consumeNextChar(currentChunk)
                                } else {
                                    //old style Mac OS newlines (\r)
                                    //don't consume character
                                }
                                break
                            }
                            case FoundCharacterType.LINE_FEED: {
                                if (nextChar === Char.Whitespace.carriageReturn) {
                                    //strange style newline (\n\r)
                                    this.consumeNextChar(currentChunk)
                                } else {
                                    //unix style newlines (\n)
                                    //don't consume character
                                }
                                break
                            }
                            case FoundCharacterType.SOLIDUS: {

                                if (nextChar === Char.Comment.solidus) {
                                    this.consumeNextChar(currentChunk)

                                    this.setCurrentTokenType([TokenType.LINE_COMMENT])
                                    return {
                                        type: [TokenDataType.LineCommentBegin, {
                                            range: { start: $.foundCharacter.startLocation, end: this.getNextLocation() },
                                        }],
                                    }

                                } else if (nextChar === Char.Comment.asterisk) {
                                    this.consumeNextChar(currentChunk)

                                    this.setCurrentTokenType([TokenType.BLOCK_COMMENT, { foundAsterisk: null }])
                                    return {
                                        type: [TokenDataType.BlockCommentBegin, {
                                            range: { start: $.foundCharacter.startLocation, end: this.getNextLocation() },
                                        }],
                                    }

                                } else {
                                    throw new Error("IMPLEMENT ME")
                                    // this.raiseError("found dangling slash", { start: this.getBeginLocation(), end: this.getEndLocation() })
                                    // this.setCurrentTokenType(null)
                                }
                            }
                            default:
                                assertUnreachable($.foundCharacter.type)
                        }

                        this.setCurrentTokenType([TokenType.NONE, { foundCharacter: null }])
                        return {
                            type: [TokenDataType.NewLine, {
                                range: { start: $.foundCharacter.startLocation, end: this.getNextLocation() },
                            }],
                        }
                    }
                }
            }
            case TokenType.QUOTED_STRING: {
                /**
                 * QUOTED STRING PROCESSING
                 */
                const $ = currentTokenType[1]

                let snippetStart: null | number = null


                while (true) {
                    //if (DEBUG) console.log(currentChunk.index, currentChar, String.fromCharCode(currentChar), 'string loop', $.slashed, $.textNode)
                    const nextChar = currentChunk.lookahead()

                    if (nextChar === null) {
                        //end of the chunk
                        //store it and wait for more input

                        if (snippetStart !== null) {
                            return onSnippet2(currentChunk.str, snippetStart, currentChunk.currentIndex)
                        }
                        return null
                    }
                    if ($.slashed) {
                        const flushChar = (str: string) => {
                            return onSnippet2(str, 0, str.length)
                        }

                        this.consumeNextChar(currentChunk)
                        if (nextChar === Char.QuotedString.quotationMark) { return flushChar('\"') }
                        else if (nextChar === Char.QuotedString.apostrophe) { return flushChar('\'') } //deviation from the JSON standard
                        else if (nextChar === Char.QuotedString.reverseSolidus) { return flushChar('\\') }
                        else if (nextChar === Char.QuotedString.solidus) { return flushChar('\/') }
                        else if (nextChar === Char.QuotedString.b) { return flushChar('\b') }
                        else if (nextChar === Char.QuotedString.f) { return flushChar('\f') }
                        else if (nextChar === Char.QuotedString.n) { return flushChar('\n') }
                        else if (nextChar === Char.QuotedString.r) { return flushChar('\r') }
                        else if (nextChar === Char.QuotedString.t) { return flushChar('\t') }
                        else if (nextChar === Char.QuotedString.u) {
                            // \uxxxx
                            $.unicode = {
                                charactersLeft: 4,
                                foundCharacters: "",
                            }
                        }
                        else {
                            //no special character
                            this.raiseError(
                                `expected special character after escape slash, but found ${String.fromCharCode(nextChar)}`,
                                { start: this.getCurrentLocation(), end: this.getNextLocation() }
                            )
                        }
                        $.slashed = false

                    } else if ($.unicode !== null) {

                        this.consumeNextChar(currentChunk)
                        $.unicode.foundCharacters += String.fromCharCode(nextChar)
                        $.unicode.charactersLeft--
                        if ($.unicode.charactersLeft === 0) {
                            const textNode = String.fromCharCode(parseInt($.unicode.foundCharacters, 16))
                            $.unicode = null
                            return onSnippet2(textNode, 0, textNode.length)

                        }
                    } else {

                        //not slashed, not unicode
                        if (nextChar === Char.QuotedString.reverseSolidus) {//backslash

                            this.consumeNextChar(currentChunk)
                            $.slashed = true
                            if (snippetStart !== null) {
                                return onSnippet2(currentChunk.str, snippetStart, currentChunk.currentIndex)
                            }
                        } else if (nextChar === $.startCharacter) {
                            /**
                             * THE QUOTED STRING IS FINISHED
                             */

                            this.consumeNextChar(currentChunk)
                            if (snippetStart !== null) {
                                return onSnippet2(currentChunk.str, snippetStart, currentChunk.currentIndex)
                            }
                            const rangeInfo = {
                                start: this.getCurrentLocation(),
                                end: this.getNextLocation(),
                            }
                            this.setCurrentTokenType([TokenType.NONE, { foundCharacter: null }])

                            return {
                                type: [TokenDataType.QuotedStringEnd, {
                                    range: rangeInfo,
                                    quote: String.fromCharCode(nextChar),
                                }],
                            }
                        } else {
                            //normal character
                            //don't flush
                            this.consumeNextChar(currentChunk)
                            if (snippetStart === null) {
                                snippetStart = currentChunk.currentIndex
                            }
                        }
                    }
                }
            }
            case TokenType.UNQUOTED_TOKEN: {
                /**
                 * unquoted token PROCESSING (null, true, false)
                 */
                return processUntilFirstNotIncludedCharacter(
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
                        return {
                            type: [TokenDataType.UnquotedTokenEnd, {
                                location: this.getNextLocation(),
                            }],
                        }
                    },
                )
            }
            case TokenType.WHITESPACE: {
                /**
                 * unquoted token PROCESSING (null, true, false)
                 */
                let snippetStart: null | number = null

                while (true) {
                    const nextChar = currentChunk.lookahead()
                    if (nextChar === null) {
                        if (snippetStart !== null) {
                            return onSnippet2(currentChunk.str, snippetStart, currentChunk.currentIndex + 1)
                        }
                        snippetStart = null
                        return null
                    }

                    function isWhiteSpaceCharacter() {
                        return (nextChar === Char.Whitespace.space || nextChar === Char.Whitespace.tab)
                    }
                    //first check if we are breaking out of an whitespace token. Can only be done by checking the character that comes directly after the whitespace token
                    if (!isWhiteSpaceCharacter()) {

                        if (snippetStart !== null) {
                            return onSnippet2(currentChunk.str, snippetStart, currentChunk.currentIndex + 1)
                        }
                        this.setCurrentTokenType([TokenType.NONE, { foundCharacter: null }])
                        return {
                            type: [TokenDataType.WhiteSpaceEnd, {
                                location: this.getNextLocation(),
                            }],
                        }

                        //this character does not belong to the whitespace so don't go to the next character by breaking
                    } else {
                        //normal character
                        //don't flush
                        this.consumeNextChar(currentChunk)
                        if (snippetStart === null) {
                            snippetStart = currentChunk.currentIndex
                        }
                    }
                }
            }
            default:
                return assertUnreachable(currentTokenType[0])
        }
    }
}