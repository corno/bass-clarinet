import * as p from "pareto"

export type ObjectData = {
    type:
    | ["verbose type"]
    | ["dictionary"]
}

export type PropertyData = {
    key: string
}

export type ElementData = {
}

export type ArrayData = {
    type:
    | ["shorthand type"]
    | ["list"]
}

export type StringValueDataType =
    | ["nonwrapped", {
        value: string
    }]
    | ["multiline", {
        lines: string[]
    }]
    | ["quoted", {
        value: string
    }]

export type StringValueData = {
    type: StringValueDataType
}

export type OptionData = {
    option: string
}

export type StackContext = {
    dictionaryDepth: number
    verboseTypeDepth: number
    listDepth: number
    shorthandTypeDepth: number
    taggedUnionDepth: number
}


export interface ObjectHandler<TokenAnnotation, NonTokenAnnotation> {
    property: ($: {
        data: PropertyData
        annotation: TokenAnnotation
        stackContext: StackContext
    }) => p.IValue<RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>>
    objectEnd: ($: {
        annotation: TokenAnnotation
        stackContext: StackContext
    }) => p.IValue<null>
}

export interface ArrayHandler<TokenAnnotation, NonTokenAnnotation> {
    element: ($: {
        data: ElementData
        stackContext: StackContext
        annotation: NonTokenAnnotation
    }) => ValueHandler<TokenAnnotation, NonTokenAnnotation>
    arrayEnd: ($: {
        annotation: TokenAnnotation
        stackContext: StackContext
    }) => p.IValue<null>
}

export interface TaggedUnionHandler<TokenAnnotation, NonTokenAnnotation> {
    option: OnOption<TokenAnnotation, NonTokenAnnotation>
    missingOption: () => void
    end: ($: {
        annotation: NonTokenAnnotation
    }) => void
}
export type OnObject<TokenAnnotation, NonTokenAnnotation> = ($: {
    data: ObjectData
    annotation: TokenAnnotation
    stackContext: StackContext
}) => ObjectHandler<TokenAnnotation, NonTokenAnnotation>

export type OnArray<TokenAnnotation, NonTokenAnnotation> = ($: {
    data: ArrayData
    annotation: TokenAnnotation
    stackContext: StackContext
}) => ArrayHandler<TokenAnnotation, NonTokenAnnotation>

export type OnString<TokenAnnotation> = ($: {
    data: StringValueData
    annotation: TokenAnnotation
    stackContext: StackContext
}) => p.IValue<boolean>


export type OnTaggedUnion<TokenAnnotation, NonTokenAnnotation> = ($: {
    annotation: TokenAnnotation
    stackContext: StackContext
}) => TaggedUnionHandler<TokenAnnotation, NonTokenAnnotation>

export type OnOption<TokenAnnotation, NonTokenAnnotation> = ($: {
    data: OptionData
    annotation: TokenAnnotation
    stackContext: StackContext
}) => RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>

export type OnMissing = () => void

export interface RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> {
    exists: ValueHandler<TokenAnnotation, NonTokenAnnotation>
    missing: OnMissing
}

export interface TreeHandler<TokenAnnotation, NonTokenAnnotation> {
    root: RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
}

export interface ValueHandler<TokenAnnotation, NonTokenAnnotation> {
    object: OnObject<TokenAnnotation, NonTokenAnnotation>
    array: OnArray<TokenAnnotation, NonTokenAnnotation>
    string: OnString<TokenAnnotation>
    taggedUnion: OnTaggedUnion<TokenAnnotation, NonTokenAnnotation>
}
