import * as p from "pareto"
import { Location, Range } from "../parser/location"

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
    String,
}


export type Token = {
    tokenString: string
    range: Range
    type:
    | [TokenType.Overhead, OverheadToken]
    | [TokenType.Structural, PunctionationData]
    | [TokenType.String, StringData]
}
export interface ITreeParser<ReturnType, ErrorType> {
    forceEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType>
    onData(
        token: Token,
        onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>
    ): p.IValue<boolean>
}