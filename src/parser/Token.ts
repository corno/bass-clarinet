import { Range } from "./location"

export type StringType =
| ["multiline", {
    lines: string[]
    terminated: boolean
}]
| ["quoted", {
    value: string
    terminated: boolean
}]
| ["apostrophed", {
    value: string
    terminated: boolean
}]
| ["nonwrapped", {
    value: string

}]

export type StringData = {
    type: StringType
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
    Structural,
    String,
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
    tokenString: string
    range: Range
    type:
    | [TokenType.Overhead, OverheadToken]
    | [TokenType.Structural, PunctionationData]
    | [TokenType.String, StringData]
}