import { Range } from "./location"

export type SimpleValueData = {
    value: string
    quote: string | null
    terminated: boolean | null //terminated is 'null' when the value is not quoted
}

export type WhiteSpaceData = {
    value: string
}

export type CommentData = {
    comment: string
    innerRange: Range //without the open and close tokens:
    indentation: null | string
}

export type PunctionationData = {
    char: number
}

export enum OverheadTokenType {
    BlockComment,
    LineComment,
    NewLine,
    WhiteSpace
}

export enum TokenType {
    Overhead,
    Punctuation,
    SimpleValue,
}

export type OverheadToken = {
    type:
    | [OverheadTokenType.BlockComment, CommentData]
    | [OverheadTokenType.LineComment, CommentData]
    | [OverheadTokenType.NewLine, {
        //
    }]
    | [OverheadTokenType.WhiteSpace, WhiteSpaceData]
}

export type Token = {
    range: Range
    type:
    | [TokenType.Overhead, OverheadToken]
    | [TokenType.Punctuation, PunctionationData]
    | [TokenType.SimpleValue, SimpleValueData]
}