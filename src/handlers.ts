import * as p from "pareto"

export type PropertyData = {
    key: string
}

export type ObjectData = {
    type:
    | ["verbose type"]
    | ["dictionary"]
}

export type ArrayData = {
    type:
    | ["shorthand type"]
    | ["list"]
}

export type Wrapper =
    | ["none"]
    | ["backtick"]
    | ["quote"]

export type SimpleValueData2 = {
    wrapper: Wrapper
    value: string
}

export type OptionData = {
    option: string
}

export type StackContext = {
    objectDepth: number
    arrayDepth: number
    taggedUnionDepth: number
}


export interface ObjectHandler<Annotation> {
    property: ($: {
        data: PropertyData
        annotation: Annotation
        stackContext: StackContext
        isFirst: boolean
    }) => p.IValue<RequiredValueHandler<Annotation>>
    objectEnd: ($: {
        annotation: Annotation
        stackContext: StackContext
    }) => p.IValue<null>
}

export interface ArrayHandler<Annotation> {
    element: ($: {
        isFirst: boolean
        stackContext: StackContext
    }) => ValueHandler<Annotation>
    arrayEnd: ($: {
        annotation: Annotation
        stackContext: StackContext
    }) => p.IValue<null>
}

export interface TaggedUnionHandler<Annotation> {
    option: OnOption<Annotation>
    missingOption: () => void
    end: () => void
}
export type OnObject<Annotation> = ($: {
    data: ObjectData
    annotation: Annotation
    stackContext: StackContext
}) => ObjectHandler<Annotation>

export type OnArray<Annotation> = ($: {
    data: ArrayData
    annotation: Annotation
    stackContext: StackContext
}) => ArrayHandler<Annotation>

export type OnSimpleValue<Annotation> = ($: {
    data: SimpleValueData2
    annotation: Annotation
}) => p.IValue<boolean>


export type OnTaggedUnion<Annotation> = ($: {
    annotation: Annotation
    stackContext: StackContext
}) => TaggedUnionHandler<Annotation>

export type OnOption<Annotation> = ($: {
    data: OptionData
    annotation: Annotation
    stackContext: StackContext
}) => RequiredValueHandler<Annotation>

export type OnMissing = () => void

export interface RequiredValueHandler<Annotation> {
    exists: ValueHandler<Annotation>
    missing: OnMissing
}

export interface ValueHandler<Annotation> {
    object: OnObject<Annotation>
    array: OnArray<Annotation>
    simpleValue: OnSimpleValue<Annotation>
    taggedUnion: OnTaggedUnion<Annotation>
}
