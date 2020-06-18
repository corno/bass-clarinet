import { Range } from "./location"

export type SimpleValueData = {
    value: string
    quote: string | null
    terminated: boolean | null
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

export enum TokenType {
    BlockComment,
    LineComment,
    NewLine,
    Punctuation,
    SimpleValue,
    WhiteSpace
}

export type Token = {
    range: Range
    type:
    | [TokenType.BlockComment, CommentData]
    | [TokenType.LineComment, CommentData]
    | [TokenType.NewLine, {
        //
    }]
    | [TokenType.Punctuation, PunctionationData]
    | [TokenType.SimpleValue, SimpleValueData]
    | [TokenType.WhiteSpace, WhiteSpaceData]
}