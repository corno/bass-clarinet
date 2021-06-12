import * as p from "pareto"
import { Location, Range } from "../generic/location"

export type Wrapping =
    | ["quote", {
        terminated: boolean
    }]
    | ["apostrophe", {
        terminated: boolean
    }]
    | ["none", {
    }]

export type SimpleStringData = {
    wrapping: Wrapping
    value: string
}

export type MultilineStringData = {
    lines: string[]
    terminated: boolean
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
export type OverheadToken = {
    type:
    | [OverheadTokenType.Comment, CommentData]
    | [OverheadTokenType.NewLine, {
        //
    }]
    | [OverheadTokenType.WhiteSpace, WhiteSpaceData]
}

export enum TokenType {
    Overhead,
    Structural,
    SimpleString,
    MultilineString,
}


export type Token = {
    tokenString: string
    range: Range
    type:
    | [TokenType.Overhead, OverheadToken]
    | [TokenType.Structural, PunctionationData]
    | [TokenType.SimpleString, SimpleStringData]
    | [TokenType.MultilineString, MultilineStringData]
}
export interface ITreeParser<ReturnType, ErrorType> {
    forceEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType>
    onData(
        token: Token,
        onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>
    ): p.IValue<boolean>
}