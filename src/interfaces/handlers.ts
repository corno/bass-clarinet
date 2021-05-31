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

export type EmptyData = {
    //
}

export type StackContext = {
    dictionaryDepth: number
    verboseTypeDepth: number
    listDepth: number
    shorthandTypeDepth: number
    taggedUnionDepth: number
}

export type Parameters<Data, Annotation> = {
    data: Data
    annotation: Annotation
    stackContext: StackContext
}


export interface ObjectHandler<TokenAnnotation, NonTokenAnnotation> {
    property: ($: Parameters<PropertyData, TokenAnnotation>) => p.IValue<RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>>
    objectEnd: ($: Parameters<EmptyData, TokenAnnotation>) => p.IValue<null>
}

export interface ArrayHandler<TokenAnnotation, NonTokenAnnotation> {
    element: ($: Parameters<ElementData, NonTokenAnnotation>) => ValueHandler<TokenAnnotation, NonTokenAnnotation>
    arrayEnd: ($: Parameters<EmptyData, TokenAnnotation>) => p.IValue<null>
}

export interface TaggedUnionHandler<TokenAnnotation, NonTokenAnnotation> {
    option: OnOption<TokenAnnotation, NonTokenAnnotation>
    missingOption: () => void
    end: ($: Parameters<EmptyData, NonTokenAnnotation>) => void
}

export type OnObject<TokenAnnotation, NonTokenAnnotation> = ($: Parameters<ObjectData, TokenAnnotation>) => ObjectHandler<TokenAnnotation, NonTokenAnnotation>
export type OnArray<TokenAnnotation, NonTokenAnnotation> = ($: Parameters<ArrayData, TokenAnnotation>) => ArrayHandler<TokenAnnotation, NonTokenAnnotation>
export type OnString<TokenAnnotation> = ($: Parameters<StringValueData, TokenAnnotation>) => p.IValue<boolean>
export type OnTaggedUnion<TokenAnnotation, NonTokenAnnotation> = ($: Parameters<EmptyData, TokenAnnotation>) => TaggedUnionHandler<TokenAnnotation, NonTokenAnnotation>
export type OnOption<TokenAnnotation, NonTokenAnnotation> = ($: Parameters<OptionData, TokenAnnotation>) => RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
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
