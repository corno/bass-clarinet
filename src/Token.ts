import { Range } from "./location"
import { Quote } from "./PreToken"

export type SimpleValueData = {
    value: string
    quote: Quote | null
    terminated: boolean | null //terminated is 'null' when the value is not quoted
}

export type WhiteSpaceData = {
    value: string
}

export type CommentData = {
    comment: string
    innerRange: Range //without the open and close tokens:
    indentation: null | string
    type: "block" | "line"
}

export type PunctionationData = {
    char: number
}

export enum OverheadTokenType {
    Comment,
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
    | [OverheadTokenType.Comment, CommentData]
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