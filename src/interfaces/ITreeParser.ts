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

export type StructuralTokenData = {
    char: number
    // | ["!"]
    // | ["<"]
    // | [">"]
    // | ["("]
    // | [")"]
    // | ["{"]
    // | ["}"]
    // | ["["]
    // | ["]"]
}

export enum TokenType {
    Structural,
    SimpleString,
    MultilineString,
}

export type Token<Annotation> = {
    annotation: Annotation
    type:
    | [TokenType.Structural, StructuralTokenData]
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