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
} from "./PreTokenizerStateTypes"
import { Location, Range, createRangeFromSingleLocation, createRangeFromLocations } from "./location"
import { PreTokenDataType, PreToken } from "./PreToken"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export type TokenizerOptions = {
    spaces_per_tab?: number //eslint-disable-line
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
        case TokenType.QUOTED_STRING: return "QUOTED_STRING"
        case TokenType.UNQUOTED_TOKEN: return "UNQUOTED_STRING"
        case TokenType.WHITESPACE: return "WHITESPACE"
        default: return assertUnreachable(stackContext[0])

    }
}

export class Chunk {
    private currentIndex: number
    public readonly str: string
    constructor(str: string) {
        this.str = str
        this.currentIndex = -1
    }
    lookahead(): number | null {
        const char = this.str.charCodeAt(this.getIndexOfNextCharacter())
        return isNaN(char) ? null : char
    }
    increaseIndex(): void {
        this.currentIndex += 1
    }
    getIndexOfNextCharacter(): number {
        return this.currentIndex + 1
    }
}

export class LocationState {
    private readonly location = {
        position: -1,
        column: 0,
        line: 1,
    }
    private readonly spacesPerTab: number
    constructor(spacesPerTab: number) {
        this.spacesPerTab = spacesPerTab
    }
    public getCurrentLocation(): Location {
        return {
            position: this.location.position + 1,
            line: this.location.line,
            column: this.location.column + 1,
        }
    }
    public getCurrentCharacterRange(): Range {
        return createRangeFromLocations(this.getCurrentLocation(), this.getNextLocation())
    }
    public getNextLocation(): Location {
        return {
            position: this.location.position + 2,
            line: this.location.line,
            column: this.location.column + 2,
        }
    }
    public increase(character: number): void {
        this.location.position++
        //set the position
        switch (character) {
            case Char.Whitespace.lineFeed:
                this.location.line++
                this.location.column = 0
                break
            case Char.Whitespace.carriageReturn:
                break
            case Char.Whitespace.tab:
                this.location.column += this.spacesPerTab
                break
            default:
                this.location.column++
        }
    }
}

type TokenReturnType = [boolean, null | PreToken]

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
    public ensureFlushed(callback: () => TokenReturnType): TokenReturnType {
        if (this.startIndex !== null) {
            return [
                false,
                {
                    type: [PreTokenDataType.Snippet, {
                        chunk: this.chunk.str,
                        begin: this.startIndex,
                        end: this.chunk.getIndexOfNextCharacter(),
                    }],
                },
            ]
        }
        return callback()
    }
}

export type PreTokenizerError = {
    type:
    | ["unterminated block comment"]
    | ["found dangling slash at the end of the document"]
    | ["unterminated string"]
    | ["found dangling slash"]
    | ["expected special character after escape slash", {
        found: string
    }]
}

export function printPreTokenizerError($: PreTokenizerError): string {

    switch ($.type[0]) {
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

export class PreTokenizer {
    public currentTokenType: CurrentToken
    private readonly onError: (error: PreTokenizerError, range: Range) => void
    private readonly locationState: LocationState

    constructor(
        locationState: LocationState,
        onError: (error: PreTokenizerError, range: Range) => void,
    ) {
        //start at the position just before the first character
        //because we are going to call currentChar = next() once at the beginning
        this.currentTokenType = [TokenType.NONE, { foundCharacter: null }]
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

                //first check if we are breaking out of an unquoted token. Can only be done by checking the character that comes directly after the unquoted token
                if (!isIncludedCharacter(nextChar)) {

                    return snippet.ensureFlushed(onEndOfToken)

                    //this character does not belong to the keyword so don't go to the next character by breaking
                } else {
                    //normal character
                    //don't flush
                    snippet.start()
                    return [true, null]
                }
            }
        )
    }
    private whileLoop(
        currentChunk: Chunk,
        callback: (
            nextChar: number,
            snippet: Snippet
        ) => TokenReturnType
    ): PreToken | null {
        const snippet = new Snippet(currentChunk)
        while (true) {

            const nextChar = currentChunk.lookahead()

            if (nextChar === null) {
                return snippet.ensureFlushed(() => [false, null])[1]
            }
            const result = callback(nextChar, snippet)
            if (result[0]) {

                const cc = currentChunk.lookahead()
                if (cc === null) {
                    throw new Error("Unexpected consume")
                }
                this.locationState.increase(cc)
                currentChunk.increaseIndex()
            }
            if (result[1] !== null) {
                return result[1]
            }
        }
    }
    public handleDanglingToken(): PreToken | null {
        const ct = this.currentTokenType
        switch (ct[0]) {
            case TokenType.BLOCK_COMMENT: {
                this.onError({ type: ["unterminated block comment" ]}, createRangeFromSingleLocation(this.locationState.getCurrentLocation()))
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
                if ($.foundCharacter !== null) {
                    if ($.foundCharacter.type === FoundCharacterType.SOLIDUS) {
                        this.onError({ type: ["found dangling slash at the end of the document" ]}, this.locationState.getCurrentCharacterRange())
                        return null
                    }
                    return {
                        type: [PreTokenDataType.NewLine, {
                            range: createRangeFromLocations(
                                $.foundCharacter.startLocation,
                                this.locationState.getCurrentLocation(),
                            ),
                        }],
                    }
                } else {
                    return null
                }
            case TokenType.QUOTED_STRING: {
                this.onError({ type: ["unterminated string" ]}, createRangeFromLocations(this.locationState.getCurrentLocation(), this.locationState.getCurrentLocation()))
                return {
                    type: [PreTokenDataType.QuotedStringEnd, {
                        range: createRangeFromLocations(
                            this.locationState.getCurrentLocation(),
                            this.locationState.getCurrentLocation(),
                        ),
                        quote: null,
                    }],
                }
            }
            case TokenType.UNQUOTED_TOKEN:
                return {
                    type: [PreTokenDataType.UnquotedTokenEnd, {
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
                                return [true, this.changeCurrentTokenType(
                                    [TokenType.NONE, { foundCharacter: null }],
                                    {
                                        type: [PreTokenDataType.BlockCommentEnd, {
                                            range: createRangeFromLocations($$.locationOfFoundAsterisk, this.locationState.getCurrentLocation()),
                                        }],
                                    }
                                )]
                            } else {
                                //false alarm, not the end of the comment

                                //don't consume next token yet
                                $$.locationOfFoundAsterisk = null
                                return [false, this.flushString("*")]
                            }
                        } else {

                            if (nextChar === Char.Comment.asterisk) {
                                return snippet.ensureFlushed(() => {
                                    $$.locationOfFoundAsterisk = this.locationState.getCurrentLocation()
                                    return [true, null]
                                })

                            } else {
                                snippet.start()
                                return [true, null]
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
                        return [false, this.changeCurrentTokenType(
                            [TokenType.NONE, { foundCharacter: null }],
                            {
                                type: [PreTokenDataType.LineCommentEnd, {
                                    location: this.locationState.getCurrentLocation(),
                                }],
                            }
                        )]
                    }
                )
            }
            case TokenType.NONE: {
                return this.whileLoop(
                    currentChunk,
                    nextChar => {

                        const $ = currentTokenType[1]
                        if ($.foundCharacter !== null) {
                            switch ($.foundCharacter.type) {
                                case FoundCharacterType.CARRIAGE_RETURN: {
                                    /*
                                    if nextChar === Char.Whitespace.lineFeed
                                        windows style newlines (\r\n)
                                    else
                                        old style Mac OS newlines (\r)
                                    */
                                    return [
                                        nextChar === Char.Whitespace.lineFeed,
                                        this.changeCurrentTokenType(
                                            [TokenType.NONE, { foundCharacter: null }],
                                            {
                                                type: [PreTokenDataType.NewLine, {
                                                    range: createRangeFromLocations($.foundCharacter.startLocation, this.locationState.getCurrentLocation()),
                                                }],
                                            }
                                        ),
                                    ]

                                }
                                case FoundCharacterType.LINE_FEED: {
                                    /*
                                    if nextChar === Char.Whitespace.carriageReturn
                                        //strange style newline (\n\r)
                                    else
                                        //unix style newlines (\n)
                                        //don't consume character
                                    */
                                    return [
                                        nextChar === Char.Whitespace.carriageReturn,
                                        this.changeCurrentTokenType(
                                            [TokenType.NONE, { foundCharacter: null }],
                                            {
                                                type: [PreTokenDataType.NewLine, {
                                                    range: createRangeFromLocations($.foundCharacter.startLocation, this.locationState.getCurrentLocation()),
                                                }],
                                            }
                                        ),
                                    ]
                                }
                                case FoundCharacterType.SOLIDUS: { // a slash: /

                                    if (nextChar === Char.Comment.solidus) {
                                        return [true, this.changeCurrentTokenType(
                                            [TokenType.LINE_COMMENT],
                                            {
                                                type: [PreTokenDataType.LineCommentBegin, {
                                                    range: createRangeFromLocations($.foundCharacter.startLocation, this.locationState.getCurrentLocation()),
                                                }],
                                            }
                                        )]

                                    } else if (nextChar === Char.Comment.asterisk) {

                                        return [true, this.changeCurrentTokenType(
                                            [TokenType.BLOCK_COMMENT, { locationOfFoundAsterisk: null }],
                                            {
                                                type: [PreTokenDataType.BlockCommentBegin, {
                                                    range: createRangeFromLocations($.foundCharacter.startLocation, this.locationState.getNextLocation()),
                                                }],
                                            }
                                        )]

                                    } else {
                                        this.onError({ type: ["found dangling slash"] }, this.locationState.getCurrentCharacterRange())
                                        $.foundCharacter = null
                                        return [false, null]
                                    }
                                }
                                default:
                                    return assertUnreachable($.foundCharacter.type)
                            }
                        } else {

                            switch (nextChar) {
                                case Char.Whitespace.carriageReturn: {

                                    $.foundCharacter = {
                                        type: FoundCharacterType.CARRIAGE_RETURN,
                                        startLocation: this.locationState.getCurrentLocation(),
                                    }
                                    return [true, null]
                                }
                                case Char.Whitespace.lineFeed: {

                                    $.foundCharacter = {
                                        type: FoundCharacterType.LINE_FEED,
                                        startLocation: this.locationState.getCurrentLocation(),
                                    }
                                    return [true, null]
                                }
                                case Char.Whitespace.space: {
                                    return [false, this.changeCurrentTokenType(
                                        [TokenType.WHITESPACE],
                                        {
                                            type: [PreTokenDataType.WhiteSpaceBegin, {
                                                location: this.locationState.getCurrentLocation(),
                                            }],
                                        }
                                    )]
                                }
                                case Char.Comment.solidus: {
                                    $.foundCharacter = {
                                        type: FoundCharacterType.SOLIDUS,
                                        startLocation: this.locationState.getCurrentLocation(),
                                    }
                                    return [true, null]
                                }
                                case Char.Whitespace.tab: {
                                    return [false, this.changeCurrentTokenType(
                                        [TokenType.WHITESPACE],
                                        {
                                            type: [PreTokenDataType.WhiteSpaceBegin, {
                                                location: this.locationState.getCurrentLocation(),
                                            }],
                                        }
                                    )]
                                }
                                case Char.QuotedString.apostrophe: {
                                    return [true, this.changeCurrentTokenType(
                                        [TokenType.QUOTED_STRING, {
                                            startCharacter: nextChar,
                                            slashed: false,
                                            unicode: null,
                                        }],
                                        {
                                            type: [PreTokenDataType.QuotedStringBegin, {
                                                quote: "'",
                                                range: this.locationState.getCurrentCharacterRange(),
                                            }],
                                        }
                                    )]
                                }
                                case Char.QuotedString.quotationMark: {
                                    return [true, this.changeCurrentTokenType(
                                        [TokenType.QUOTED_STRING, {
                                            startCharacter: nextChar,
                                            slashed: false,
                                            unicode: null,
                                        }],
                                        {
                                            type: [PreTokenDataType.QuotedStringBegin, {
                                                quote: "\"",
                                                range: this.locationState.getCurrentCharacterRange(),
                                            }],
                                        }
                                    )]
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
                                        return [false, this.changeCurrentTokenType(
                                            [TokenType.UNQUOTED_TOKEN],
                                            {
                                                type: [PreTokenDataType.UnquotedTokenBegin, {
                                                    location: this.locationState.getCurrentLocation(),
                                                }],
                                            }
                                        )]
                                    } else {
                                        return [true, {
                                            type: [PreTokenDataType.Punctuation, {
                                                range: this.locationState.getCurrentCharacterRange(),
                                                char: nextChar,
                                            }],
                                        }]
                                    }

                                }
                            }

                        }
                    }
                )
            }
            case TokenType.QUOTED_STRING: {
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
                                return [true, this.flushString(str)]
                            }

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
                                $.slashed = false
                                $.unicode = {
                                    charactersLeft: 4,
                                    foundCharacters: "",
                                }
                                return [true, null]
                            }
                            else {
                                //no special character

                                this.onError(
                                    {
                                        type: ["expected special character after escape slash", {
                                            found: String.fromCharCode(nextChar),
                                        }],
                                    },
                                    this.locationState.getCurrentCharacterRange()
                                )
                                return [true, null]
                            }

                        } else if ($.unicode !== null) {

                            $.unicode.foundCharacters += String.fromCharCode(nextChar)
                            $.unicode.charactersLeft--
                            if ($.unicode.charactersLeft === 0) {
                                const textNode = String.fromCharCode(parseInt($.unicode.foundCharacters, 16))
                                $.unicode = null
                                return [true, this.flushString(textNode)]
                            } else {
                                return [true, null]
                            }
                        } else {
                            //not slashed, not unicode
                            if (nextChar === Char.QuotedString.reverseSolidus) {//backslash
                                return snippet.ensureFlushed(() => {
                                    $.slashed = true
                                    return [true, null]
                                })
                            } else if (nextChar === $.startCharacter) {
                                /**
                                 * THE QUOTED STRING IS FINISHED
                                 */

                                return snippet.ensureFlushed(() => {
                                    const rangeInfo = this.locationState.getCurrentCharacterRange()

                                    return [true, this.changeCurrentTokenType(
                                        [TokenType.NONE, { foundCharacter: null }],
                                        {
                                            type: [PreTokenDataType.QuotedStringEnd, {
                                                range: rangeInfo,
                                                quote: String.fromCharCode(nextChar),
                                            }],
                                        }
                                    )]
                                })
                            } else {
                                //normal character
                                //don't flush
                                snippet.start()
                                return [true, null]
                            }
                        }
                    }
                )

            }
            case TokenType.UNQUOTED_TOKEN: {
                /**
                 * unquoted token PROCESSING (null, true, false)
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

                            || char === Char.QuotedString.quotationMark
                            || char === Char.QuotedString.apostrophe
                        )
                        return !isOtherCharacter
                    },
                    () => {
                        return [false, this.changeCurrentTokenType(
                            [TokenType.NONE, { foundCharacter: null }],
                            {
                                type: [PreTokenDataType.UnquotedTokenEnd, {
                                    location: this.locationState.getCurrentLocation(),
                                }],
                            }
                        )]
                    },
                )
            }
            case TokenType.WHITESPACE: {
                /**
                 * unquoted token PROCESSING (null, true, false)
                 */

                return this.whileLoop(
                    currentChunk,
                    (nextChar, snippet) => {
                        //first check if we are breaking out of an whitespace token. Can only be done by checking the character that comes directly after the whitespace token
                        if (nextChar !== Char.Whitespace.space && nextChar !== Char.Whitespace.tab) {
                            return snippet.ensureFlushed(() => {
                                return [false, this.changeCurrentTokenType(
                                    [TokenType.NONE, { foundCharacter: null }],
                                    {
                                        type: [PreTokenDataType.WhiteSpaceEnd, {
                                            location: this.locationState.getCurrentLocation(),
                                        }],
                                    }
                                )]
                            })
                        } else {
                            //whitespace character
                            snippet.start()
                            return [true, null]
                        }
                    }
                )

            }
            default:
                return assertUnreachable(currentTokenType[0])
        }
    }
}
