import { Location, Range } from "../location"
//import { Char } from "../Characters"

export enum PreTokenDataType {
    BlockCommentBegin,
    BlockCommentEnd,
    LineCommentBegin,
    LineCommentEnd,
    NewLine,
    Punctuation,
    WrappedStringBegin,
    WrappedStringEnd,
    Snippet,
    NonWrappedStringBegin,
    NonWrappedStringEnd,
    WhiteSpaceBegin,
    WhiteSpaceEnd,
}

/**
 * A PreToken is a low level token
 */
 export type PreToken = {
    type:
    | [PreTokenDataType.BlockCommentBegin, {
        range: Range
    }]
    | [PreTokenDataType.BlockCommentEnd, {
        range: Range //| null
    }]
    | [PreTokenDataType.LineCommentBegin, {
        range: Range
    }]
    | [PreTokenDataType.LineCommentEnd, {
        location: Location //| null
    }]
    | [PreTokenDataType.NewLine, {
        range: Range //| null
    }]
    | [PreTokenDataType.Punctuation, {
        char: number
        range: Range
    }]
    | [PreTokenDataType.WrappedStringBegin, {
        range: Range
        type: WrappedStringType
    }]
    | [PreTokenDataType.WrappedStringEnd, {
        range: Range
        wrapper: string | null
    }]
    | [PreTokenDataType.Snippet, {
        chunk: string
        begin: number
        end: number
    }]
    | [PreTokenDataType.NonWrappedStringBegin, {
        location: Location
    }]
    | [PreTokenDataType.NonWrappedStringEnd, {
        location: Location //| null
    }]
    | [PreTokenDataType.WhiteSpaceBegin, {
        location: Location
    }]
    | [PreTokenDataType.WhiteSpaceEnd, {
        location: Location //| null
    }]
}

export type PreTokenizerError = {
    type:
    | ["unterminated block comment"]
    | ["found dangling slash at the end of the document"]
    | ["unterminated string"]
    | ["found dangling slash"]
    | ["expected hexadecimal digit", {
        found: string
    }]
    | ["expected special character after escape slash", {
        found: string
    }]
}

export interface ILocationState {
    getCurrentLocation(): Location
    getNextLocation(): Location
    increase(character: number): void
}

export interface IChunk {
    lookahead(): number | null
    getIndexOfNextCharacter(): number
    getString(): string
    increaseIndex(): void
}

export interface IPreTokenizer {
    handleDanglingToken(): PreToken | null
    createNextToken(currentChunk: IChunk): null | PreToken
}

export type WrappedStringType =
    | ["apostrophed", {
        //
    }]
    | ["quoted", {
        //
    }]
    | ["multiline", {
        previousLines: string[]
    }]
