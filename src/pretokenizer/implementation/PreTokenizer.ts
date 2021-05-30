/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/
import * as Char from "../../Characters"
import {
    TokenType,
    CurrentToken,
    FoundNewlineCharacterType,
    FoundNewlineCharacter,
} from "./PreTokenizerStateTypes"
import { Range, createRangeFromSingleLocation, createRangeFromLocations } from "../../location"
import { Chunk, ILocationState, IPreTokenizer, PreToken, PreTokenDataType, PreTokenizerError } from "../api"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const DEBUG = false

function getStateDescription(stackContext: CurrentToken | null): string {
    if (stackContext === null) {
        return "NONE"
    }
    switch (stackContext[0]) {
        case TokenType.BLOCK_COMMENT: return "BLOCK_COMMENT"
        case TokenType.LINE_COMMENT: return "LINE_COMMENT"
        case TokenType.NONE: return "NONE"
        case TokenType.WRAPPED_STRING: return "QUOTED_STRING"
        case TokenType.NONWRAPPED_STRING: return "UNWRAPPED_STRING"
        case TokenType.WHITESPACE: return "WHITESPACE"
        default: return assertUnreachable(stackContext[0])

    }
}

type TokenReturnType = {
    consumeCharacter: boolean
    preToken: null | PreToken
}

class Snippet {
    private readonly chunk: Chunk
    private startIndex: null | number = null
    constructor(chunk: Chunk) {
        this.chunk = chunk
    }
    public start() {
        if (this.startIndex === null) {
            this.startIndex = this.chunk.getIndexOfNextCharacter()
        }
    }
    /**
     * if not flushed, the callback is not called.
     * the current character position should not change so that the next round
     * the same call will be made, but now it is flushed, so the callback will be called
     */
    public ensureFlushed(callback: () => TokenReturnType): TokenReturnType {
        if (this.startIndex !== null) {
            return {
                consumeCharacter: false,
                preToken: {
                    type: [PreTokenDataType.Snippet, {
                        chunk: this.chunk.str,
                        begin: this.startIndex,
                        end: this.chunk.getIndexOfNextCharacter(),
                    }],
                },
            }
        }
        return callback()
    }
}

function getCurrentCharacterRange(ls: ILocationState): Range {
    return createRangeFromLocations(ls.getCurrentLocation(), ls.getNextLocation())
}

export function printPreTokenizerError($: PreTokenizerError): string {

    switch ($.type[0]) {
        case "expected hexadecimal digit": {
            const $$ = $.type[1]
            return `expected hexadecimal digit: 0-9, A-F or a-f, but found ${$$.found}`
        }
        case "expected special character after escape slash": {
            const $$ = $.type[1]
            return `expected special character after escape slash, but found ${$$.found}`
        }
        case "found dangling slash": {
            return `found dangling slash`
        }
        case "found dangling slash at the end of the document": {
            return `found dangling slash at the end of the document`
        }
        case "unterminated block comment": {
            return `unterminated block comment`
        }
        case "unterminated string": {
            return `unterminated string`
        }
        default:
            return assertUnreachable($.type[0])
    }
}

type OnError = ($: {
    error: PreTokenizerError
    range: Range
}) => void


export function createPreTokenizer(
    locationState: ILocationState,
    onError: OnError,
): IPreTokenizer {


    class PreTokenizer {
        public currentTokenType: CurrentToken
        private readonly onError: OnError
        private readonly locationState: ILocationState

        constructor(
        ) {
            //start at the position just before the first character
            //because we are going to call currentChar = next() once at the beginning
            this.currentTokenType = [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }]
            this.onError = onError
            this.locationState = locationState
        }
        private changeCurrentTokenType(tokenType: CurrentToken, tokenData: PreToken): PreToken {
            if (DEBUG) console.log("setting token state to", getStateDescription(tokenType))
            this.currentTokenType = tokenType
            return tokenData
        }
        private flushString(
            str: string,
        ): PreToken {
            return {
                type: [PreTokenDataType.Snippet, {
                    chunk: str,
                    begin: 0,
                    end: str.length,
                }],
            }
        }
        private processUntilFirstNotIncludedCharacter(
            currentChunk: Chunk,
            isIncludedCharacter: (char: number) => boolean,
            onEndOfToken: () => TokenReturnType,
        ): null | PreToken {
            return this.whileLoop(
                currentChunk,
                (nextChar, snippet) => {

                    //first check if we are breaking out of an nonwrapped string. Can only be done by checking the character that comes directly after the nonwrapped string
                    if (!isIncludedCharacter(nextChar)) {

                        return snippet.ensureFlushed(onEndOfToken)

                        //this character does not belong to the keyword so don't go to the next character by breaking
                    } else {
                        //normal character
                        //don't flush
                        snippet.start()
                        return {
                            consumeCharacter: true,
                            preToken: null,
                        }
                    }
                }
            )
        }
        private whileLoop(
            currentChunk: Chunk,
            callback: (
                nextChar: number,
                snippet: Snippet,
            ) => TokenReturnType
        ): PreToken | null {
            const snippet = new Snippet(currentChunk)
            while (true) {

                const nextChar = currentChunk.lookahead()

                if (nextChar === null) {
                    return snippet.ensureFlushed(() => {
                        return {
                            consumeCharacter: false,
                            preToken: null,
                        }
                    }).preToken
                }
                const result = callback(nextChar, snippet)
                if (result.consumeCharacter) {
                    const cc = currentChunk.lookahead()
                    if (cc === null) {
                        throw new Error("Unexpected consume")
                    }
                    this.locationState.increase(cc)
                    currentChunk.increaseIndex()
                }
                if (result.preToken !== null) {
                    return result.preToken
                }
            }
        }
        public handleDanglingToken(): PreToken | null {
            const ct = this.currentTokenType
            switch (ct[0]) {
                case TokenType.BLOCK_COMMENT: {
                    this.onError({
                        error: { type: ["unterminated block comment"] },
                        range: createRangeFromSingleLocation(this.locationState.getCurrentLocation()),
                    })
                    return {
                        type: [PreTokenDataType.BlockCommentEnd, {
                            range: createRangeFromSingleLocation(this.locationState.getCurrentLocation()),
                        }],
                    }
                }
                case TokenType.LINE_COMMENT: {
                    return {
                        type: [PreTokenDataType.LineCommentEnd, {
                            location: this.locationState.getCurrentLocation(),
                        }],
                    }
                }
                case TokenType.NONE:
                    const $ = ct[1]
                    if ($.foundNewlineCharacter !== null) {
                        return {
                            type: [PreTokenDataType.NewLine, {
                                range: createRangeFromLocations(
                                    $.foundNewlineCharacter.startLocation,
                                    this.locationState.getCurrentLocation(),
                                ),
                            }],
                        }
                    } else if ($.foundSolidus) {
                        this.onError({
                            error: { type: ["found dangling slash at the end of the document"] },
                            range: getCurrentCharacterRange(this.locationState),
                        })
                        return null
                    } else {
                        return null
                    }
                case TokenType.WRAPPED_STRING: {
                    this.onError({
                        error: { type: ["unterminated string"] },
                        range: createRangeFromLocations(this.locationState.getCurrentLocation(), this.locationState.getCurrentLocation()),
                    })
                    return {
                        type: [PreTokenDataType.WrappedStringEnd, {
                            range: createRangeFromLocations(
                                this.locationState.getCurrentLocation(),
                                this.locationState.getCurrentLocation(),
                            ),
                            wrapper: null,
                        }],
                    }
                }
                case TokenType.NONWRAPPED_STRING:
                    return {
                        type: [PreTokenDataType.NonWrappedStringEnd, {
                            location: this.locationState.getCurrentLocation(),
                        }],
                    }
                case TokenType.WHITESPACE:
                    return {
                        type: [PreTokenDataType.WhiteSpaceEnd, {
                            location: this.locationState.getCurrentLocation(),
                        }],
                    }
                default:
                    return assertUnreachable(ct[0])
            }
        }
        private handleNewlineCharacter(
            fnlc: FoundNewlineCharacter,
            nextChar: number,
        ): TokenReturnType {
            switch (fnlc.type) {
                case FoundNewlineCharacterType.CARRIAGE_RETURN: {
                    /*
                    if nextChar === Char.Whitespace.lineFeed
                        windows style newlines (\r\n)
                    else
                        old style Mac OS newlines (\r)
                    */
                    return {
                        consumeCharacter: nextChar === Char.Whitespace.lineFeed,
                        preToken: this.changeCurrentTokenType(
                            [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }],
                            {
                                type: [PreTokenDataType.NewLine, {
                                    range: createRangeFromLocations(fnlc.startLocation, this.locationState.getCurrentLocation()),
                                }],
                            }
                        ),
                    }

                }
                case FoundNewlineCharacterType.LINE_FEED: {
                    /*
                    if nextChar === Char.Whitespace.carriageReturn
                        //strange style newline (\n\r)
                    else
                        //unix style newlines (\n)
                        //don't consume character
                    */
                    return {
                        consumeCharacter: nextChar === Char.Whitespace.carriageReturn,
                        preToken: this.changeCurrentTokenType(
                            [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }],
                            {
                                type: [PreTokenDataType.NewLine, {
                                    range: createRangeFromLocations(fnlc.startLocation, this.locationState.getCurrentLocation()),
                                }],
                            }
                        ),
                    }
                }
                default:
                    return assertUnreachable(fnlc.type)
            }
        }
        public createNextToken(currentChunk: Chunk): null | PreToken {
            const currentTokenType = this.currentTokenType
            switch (currentTokenType[0]) {
                case TokenType.BLOCK_COMMENT: {
                    const $$ = currentTokenType[1]
                    return this.whileLoop(
                        currentChunk,
                        (nextChar, snippet) => {
                            if ($$.locationOfFoundAsterisk !== null) {
                                if (nextChar === Char.Comment.solidus) {
                                    //end of block comment
                                    return {
                                        consumeCharacter: true,
                                        preToken: this.changeCurrentTokenType(
                                            [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }],
                                            {
                                                type: [PreTokenDataType.BlockCommentEnd, {
                                                    range: createRangeFromLocations($$.locationOfFoundAsterisk, this.locationState.getCurrentLocation()),
                                                }],
                                            }
                                        ),
                                    }
                                } else {
                                    //false alarm, not the end of the comment

                                    //don't consume next token yet
                                    $$.locationOfFoundAsterisk = null
                                    return { consumeCharacter: false, preToken: this.flushString("*") }
                                }
                            } else {

                                if (nextChar === Char.Comment.asterisk) {
                                    return snippet.ensureFlushed(() => {
                                        $$.locationOfFoundAsterisk = this.locationState.getCurrentLocation()
                                        return {
                                            consumeCharacter: true,
                                            preToken: null,
                                        }
                                    })

                                } else {
                                    snippet.start()
                                    return {
                                        consumeCharacter: true,
                                        preToken: null,
                                    }
                                }

                            }
                        }
                    )
                }
                case TokenType.LINE_COMMENT: {
                    return this.processUntilFirstNotIncludedCharacter(
                        currentChunk,
                        char => {
                            return char !== Char.Whitespace.lineFeed &&
                                char !== Char.Whitespace.carriageReturn
                        },
                        () => {
                            return {
                                consumeCharacter: false,
                                preToken: this.changeCurrentTokenType(
                                    [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }],
                                    {
                                        type: [PreTokenDataType.LineCommentEnd, {
                                            location: this.locationState.getCurrentLocation(),
                                        }],
                                    },
                                ),
                            }
                        }
                    )
                }
                case TokenType.NONE: {
                    return this.whileLoop(
                        currentChunk,
                        nextChar => {

                            const $ = currentTokenType[1]
                            if ($.foundNewlineCharacter !== null) {
                                return this.handleNewlineCharacter($.foundNewlineCharacter, nextChar)
                            } else if ($.foundSolidus !== null) {

                                if (nextChar === Char.Comment.solidus) {
                                    return {
                                        consumeCharacter: true,
                                        preToken: this.changeCurrentTokenType(
                                            [TokenType.LINE_COMMENT],
                                            {
                                                type: [PreTokenDataType.LineCommentBegin, {
                                                    range: createRangeFromLocations($.foundSolidus, this.locationState.getCurrentLocation()),
                                                }],
                                            },
                                        ),
                                    }

                                } else if (nextChar === Char.Comment.asterisk) {

                                    return {
                                        consumeCharacter: true,
                                        preToken: this.changeCurrentTokenType(
                                            [TokenType.BLOCK_COMMENT, { locationOfFoundAsterisk: null }],
                                            {
                                                type: [PreTokenDataType.BlockCommentBegin, {
                                                    range: createRangeFromLocations($.foundSolidus, this.locationState.getNextLocation()),
                                                }],
                                            },
                                        ),
                                    }

                                } else {
                                    this.onError({
                                        error: { type: ["found dangling slash"] },
                                        range: getCurrentCharacterRange(this.locationState),
                                    })
                                    $.foundSolidus = null
                                    return {
                                        consumeCharacter: false,
                                        preToken: null,
                                    }
                                }

                            } else {

                                switch (nextChar) {
                                    case Char.Whitespace.carriageReturn: {

                                        $.foundNewlineCharacter = {
                                            type: FoundNewlineCharacterType.CARRIAGE_RETURN,
                                            startLocation: this.locationState.getCurrentLocation(),
                                        }
                                        return {
                                            consumeCharacter: true,
                                            preToken: null,
                                        }
                                    }
                                    case Char.Whitespace.lineFeed: {

                                        $.foundNewlineCharacter = {
                                            type: FoundNewlineCharacterType.LINE_FEED,
                                            startLocation: this.locationState.getCurrentLocation(),
                                        }
                                        return {
                                            consumeCharacter: true,
                                            preToken: null,
                                        }
                                    }
                                    case Char.Whitespace.space: {
                                        return {
                                            consumeCharacter: false,
                                            preToken: this.changeCurrentTokenType(
                                                [TokenType.WHITESPACE],
                                                {
                                                    type: [PreTokenDataType.WhiteSpaceBegin, {
                                                        location: this.locationState.getCurrentLocation(),
                                                    }],
                                                },
                                            ),
                                        }
                                    }
                                    case Char.Comment.solidus: {
                                        $.foundSolidus = this.locationState.getCurrentLocation()
                                        return {
                                            consumeCharacter: true,
                                            preToken: null,
                                        }
                                    }
                                    case Char.Whitespace.tab: {
                                        return {
                                            consumeCharacter: false,
                                            preToken: this.changeCurrentTokenType(
                                                [TokenType.WHITESPACE],
                                                {
                                                    type: [PreTokenDataType.WhiteSpaceBegin, {
                                                        location: this.locationState.getCurrentLocation(),
                                                    }],
                                                },
                                            ),
                                        }
                                    }
                                    case Char.WrappedString.apostrophe: {
                                        return {
                                            consumeCharacter: true,
                                            preToken: this.changeCurrentTokenType(
                                                [TokenType.WRAPPED_STRING, {
                                                    startCharacter: nextChar,
                                                    slashed: false,
                                                    unicode: null,
                                                    foundNewlineCharacter: null,
                                                }],
                                                {
                                                    type: [PreTokenDataType.WrappedStringBegin, {
                                                        type: ["apostrophed", {}],
                                                        range: getCurrentCharacterRange(this.locationState),
                                                    }],
                                                },
                                            ),
                                        }
                                    }
                                    case Char.WrappedString.backtick: {
                                        return {
                                            consumeCharacter: true,
                                            preToken: this.changeCurrentTokenType(
                                                [TokenType.WRAPPED_STRING, {
                                                    startCharacter: nextChar,
                                                    slashed: false,
                                                    unicode: null,
                                                    foundNewlineCharacter: null,
                                                }],
                                                {
                                                    type: [PreTokenDataType.WrappedStringBegin, {
                                                        type: ["multiline", {
                                                            previousLines: [],
                                                        }],
                                                        range: getCurrentCharacterRange(this.locationState),
                                                    }],
                                                },
                                            ),
                                        }
                                    }
                                    case Char.WrappedString.quotationMark: {
                                        return {
                                            consumeCharacter: true,
                                            preToken: this.changeCurrentTokenType(
                                                [TokenType.WRAPPED_STRING, {
                                                    startCharacter: nextChar,
                                                    slashed: false,
                                                    unicode: null,
                                                    foundNewlineCharacter: null,
                                                }],
                                                {
                                                    type: [PreTokenDataType.WrappedStringBegin, {
                                                        type: ["quoted", {}],
                                                        range: getCurrentCharacterRange(this.locationState),
                                                    }],
                                                },
                                            ),
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
                                                nextChar === Char.Punctuation.verticalLine
                                            ) {
                                                return true
                                            }
                                            return false
                                        }
                                        if (!nextIsPunctuation()) {
                                            return {
                                                consumeCharacter: false,
                                                preToken: this.changeCurrentTokenType(
                                                    [TokenType.NONWRAPPED_STRING],
                                                    {
                                                        type: [PreTokenDataType.NonWrappedStringBegin, {
                                                            location: this.locationState.getCurrentLocation(),
                                                        }],
                                                    },
                                                ),
                                            }
                                        } else {
                                            return {
                                                consumeCharacter: true,
                                                preToken: {
                                                    type: [PreTokenDataType.Punctuation, {
                                                        range: getCurrentCharacterRange(this.locationState),
                                                        char: nextChar,
                                                    }],
                                                },
                                            }
                                        }

                                    }
                                }

                            }
                        }
                    )
                }
                case TokenType.WRAPPED_STRING: {
                    /**
                     * QUOTED STRING PROCESSING
                     */
                    const $ = currentTokenType[1]

                    return this.whileLoop(
                        currentChunk,
                        (nextChar, snippet): TokenReturnType => {

                            if ($.slashed) {
                                const flushChar = (str: string): TokenReturnType => {
                                    $.slashed = false
                                    return {
                                        consumeCharacter: true,
                                        preToken: this.flushString(str),
                                    }
                                }

                                if (nextChar === Char.WrappedString.quotationMark) { return flushChar('"') }
                                else if (nextChar === Char.WrappedString.apostrophe) { return flushChar('\'') } //deviation from the JSON standard
                                else if (nextChar === Char.WrappedString.apostrophe) { return flushChar('`') } //deviation from the JSON standard
                                else if (nextChar === Char.WrappedString.reverseSolidus) { return flushChar('\\') }
                                else if (nextChar === Char.WrappedString.solidus) { return flushChar('\/') }
                                else if (nextChar === Char.WrappedString.b) {
                                    return flushChar('\b')
                                }
                                else if (nextChar === Char.WrappedString.f) { return flushChar('\f') }
                                else if (nextChar === Char.WrappedString.n) {
                                    if ($.startCharacter === Char.WrappedString.backtick) {
                                        return snippet.ensureFlushed(() => {
                                            $.slashed = false
                                            return {
                                                consumeCharacter: true,
                                                preToken: {
                                                    type: [PreTokenDataType.NewLine, {
                                                        range: getCurrentCharacterRange(this.locationState),
                                                    }],
                                                },
                                            }
                                        })
                                    } else {
                                        return flushChar('\n')
                                    }
                                }
                                else if (nextChar === Char.WrappedString.r) {
                                    if ($.startCharacter === Char.WrappedString.backtick) {
                                        $.slashed = false

                                        return snippet.ensureFlushed(() => {
                                            return {
                                                consumeCharacter: true,
                                                preToken: {
                                                    type: [PreTokenDataType.NewLine, {
                                                        range: getCurrentCharacterRange(this.locationState),
                                                    }],
                                                },
                                            }
                                        })
                                    } else {
                                        return flushChar('\r')
                                    }
                                }
                                else if (nextChar === Char.WrappedString.t) { return flushChar('\t') }
                                else if (nextChar === Char.WrappedString.u) {
                                    // \uxxxx
                                    $.slashed = false
                                    $.unicode = {
                                        charactersLeft: 4,
                                        foundCharacters: "",
                                    }
                                    return {
                                        consumeCharacter: true,
                                        preToken: null,
                                    }
                                }
                                else {
                                    //no special character

                                    this.onError({
                                        error: {
                                            type: ["expected special character after escape slash", {
                                                found: String.fromCharCode(nextChar),
                                            }],
                                        },
                                        range: getCurrentCharacterRange(this.locationState),
                                    })
                                    return {
                                        consumeCharacter: true,
                                        preToken: null,
                                    }
                                }

                            } else if ($.unicode !== null) {
                                if (
                                    (nextChar < Char.UnicodeChars["0"] && nextChar > Char.UnicodeChars["9"])
                                    &&
                                    (nextChar < Char.UnicodeChars.A && nextChar > Char.UnicodeChars.F)
                                    &&
                                    (nextChar < Char.UnicodeChars.a && nextChar > Char.UnicodeChars.f)
                                ) {

                                    this.onError({
                                        error: {
                                            type: ["expected hexadecimal digit", {
                                                found: String.fromCharCode(nextChar),
                                            }],
                                        },
                                        range: getCurrentCharacterRange(this.locationState),
                                    })
                                }
                                const nextCharAsString = String.fromCharCode(nextChar)

                                $.unicode.foundCharacters += nextCharAsString
                                $.unicode.charactersLeft--
                                if ($.unicode.charactersLeft === 0) {
                                    const textNode = String.fromCharCode(parseInt($.unicode.foundCharacters, 16))
                                    $.unicode = null
                                    return {
                                        consumeCharacter: true,
                                        preToken: this.flushString(textNode),
                                    }
                                } else {
                                    return {
                                        consumeCharacter: true,
                                        preToken: null,
                                    }
                                }
                            } else if ($.foundNewlineCharacter !== null) {

                                switch ($.foundNewlineCharacter.type) {
                                    case FoundNewlineCharacterType.CARRIAGE_RETURN: {
                                        /*
                                        if nextChar === Char.Whitespace.lineFeed
                                            windows style newlines (\r\n)
                                        else
                                            old style Mac OS newlines (\r)
                                        */
                                        const fnlc = $.foundNewlineCharacter
                                        $.foundNewlineCharacter = null
                                        return {
                                            consumeCharacter: nextChar === Char.Whitespace.lineFeed,
                                            preToken: {
                                                type: [PreTokenDataType.NewLine, {
                                                    range: createRangeFromLocations(fnlc.startLocation, this.locationState.getCurrentLocation()),
                                                }],
                                            },
                                        }

                                    }
                                    case FoundNewlineCharacterType.LINE_FEED: {
                                        /*
                                        if nextChar === Char.Whitespace.carriageReturn
                                            //strange style newline (\n\r)
                                        else
                                            //unix style newlines (\n)
                                            //don't consume character
                                        */
                                        const fnlc = $.foundNewlineCharacter
                                        $.foundNewlineCharacter = null
                                        console.error("LINE FEED")
                                        return {
                                            consumeCharacter: nextChar === Char.Whitespace.carriageReturn,
                                            preToken: {
                                                type: [PreTokenDataType.NewLine, {
                                                    range: createRangeFromLocations(fnlc.startLocation, this.locationState.getCurrentLocation()),
                                                }],
                                            },
                                        }
                                    }
                                    default:
                                        return assertUnreachable($.foundNewlineCharacter.type)
                                }
                            } else {
                                //not slashed, not unicode, not newline
                                if (nextChar === Char.WrappedString.reverseSolidus) {//backslash
                                    return snippet.ensureFlushed(() => {
                                        $.slashed = true
                                        return {
                                            consumeCharacter: true,
                                            preToken: null,
                                        }
                                    })
                                } else if (nextChar === $.startCharacter) {
                                    /**
                                     * THE QUOTED STRING IS FINISHED
                                     */

                                    return snippet.ensureFlushed(() => {
                                        const rangeInfo = getCurrentCharacterRange(this.locationState)

                                        return {
                                            consumeCharacter: true,
                                            preToken: this.changeCurrentTokenType(
                                                [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }],
                                                {
                                                    type: [PreTokenDataType.WrappedStringEnd, {
                                                        range: rangeInfo,
                                                        wrapper: String.fromCharCode(nextChar),
                                                    }],
                                                },
                                            ),
                                        }
                                    })
                                } else if (nextChar === Char.Whitespace.carriageReturn || nextChar === Char.Whitespace.lineFeed) {
                                    if ($.startCharacter === Char.WrappedString.backtick) { //multiline

                                        return snippet.ensureFlushed(() => {

                                            $.foundNewlineCharacter = {
                                                type: nextChar === Char.Whitespace.carriageReturn ? FoundNewlineCharacterType.CARRIAGE_RETURN : FoundNewlineCharacterType.LINE_FEED,
                                                startLocation: this.locationState.getCurrentLocation(),
                                            }
                                            return {
                                                consumeCharacter: true,
                                                preToken: null,
                                            }
                                        })
                                    } else {
                                        return snippet.ensureFlushed(() => {
                                            const rangeInfo = getCurrentCharacterRange(this.locationState)
                                            this.onError({
                                                error: { type: ["unterminated string"] },
                                                range: rangeInfo,
                                            })

                                            return {
                                                consumeCharacter: true, preToken: this.changeCurrentTokenType(
                                                    [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }],
                                                    {
                                                        type: [PreTokenDataType.WrappedStringEnd, {
                                                            range: rangeInfo,
                                                            wrapper: null,
                                                        }],
                                                    }
                                                ),
                                            }
                                        })
                                    }
                                } else {
                                    //normal character
                                    //don't flush
                                    snippet.start()
                                    return {
                                        consumeCharacter: true,
                                        preToken: null,
                                    }
                                }
                            }
                        }
                    )

                }
                case TokenType.NONWRAPPED_STRING: {
                    /**
                     * nonwrapped string PROCESSING (null, true, false)
                     */
                    return this.processUntilFirstNotIncludedCharacter(
                        currentChunk,
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

                                || char === Char.Comment.solidus

                                || char === Char.WrappedString.quotationMark
                                || char === Char.WrappedString.apostrophe
                            )
                            return !isOtherCharacter
                        },
                        () => {
                            return {
                                consumeCharacter: false,
                                preToken: this.changeCurrentTokenType(
                                    [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }],
                                    {
                                        type: [PreTokenDataType.NonWrappedStringEnd, {
                                            location: this.locationState.getCurrentLocation(),
                                        }],
                                    }
                                ),
                            }
                        },
                    )
                }
                case TokenType.WHITESPACE: {
                    /**
                     * nonwrapped string PROCESSING (null, true, false)
                     */

                    return this.whileLoop(
                        currentChunk,
                        (nextChar, snippet) => {
                            //first check if we are breaking out of an whitespace token. Can only be done by checking the character that comes directly after the whitespace token
                            if (nextChar !== Char.Whitespace.space && nextChar !== Char.Whitespace.tab) {
                                return snippet.ensureFlushed(() => {
                                    return {
                                        consumeCharacter: false,
                                        preToken: this.changeCurrentTokenType(
                                            [TokenType.NONE, { foundNewlineCharacter: null, foundSolidus: null }],
                                            {
                                                type: [PreTokenDataType.WhiteSpaceEnd, {
                                                    location: this.locationState.getCurrentLocation(),
                                                }],
                                            }
                                        ),
                                    }
                                })
                            } else {
                                //whitespace character
                                snippet.start()
                                return {
                                    consumeCharacter: true,
                                    preToken: null,
                                }
                            }
                        }
                    )

                }
                default:
                    return assertUnreachable(currentTokenType[0])
            }
        }
    }
    return new PreTokenizer()
}