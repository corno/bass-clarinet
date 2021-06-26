import * as p from "pareto"

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

// export type WhiteSpaceData = {
//     value: string
// }

// export type CommentData = {
//     comment: string
//     innerRange: Range //without the open and close tokens:
//     indentation: null | string
//     type: "block" | "line"
// }

export type PunctionationData = {
    char: number
}

// export enum OverheadTokenType {
//     Comment,
//     NewLine,
//     WhiteSpace
// }

// export type OverheadToken = {
//     type:
//     | [OverheadTokenType.Comment, CommentData]
//     | [OverheadTokenType.NewLine, {
//         //
//     }]
//     | [OverheadTokenType.WhiteSpace, WhiteSpaceData]
// }

export enum TokenType {
//    Overhead,
    Structural,
    SimpleString,
    MultilineString,
}

export type Token<Annotation> = {
    annotation: Annotation
    type:
    //| [TokenType.Overhead, OverheadToken]
    | [TokenType.Structural, PunctionationData]
    | [TokenType.SimpleString, SimpleStringData]
    | [TokenType.MultilineString, MultilineStringData]
}

export interface ITreeParser<Annotation, ReturnType, ErrorType> {
    forceEnd(aborted: boolean, annotation: Annotation): p.IUnsafeValue<ReturnType, ErrorType>
    onData(
        token: Token<Annotation>,
        onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>
    ): p.IValue<boolean>
}