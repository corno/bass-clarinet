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


export interface ObjectHandler<Annotation> {
    property: ($: {
        data: PropertyData
        annotation: Annotation
    }) => p.IValue<RequiredValueHandler<Annotation>>
    objectEnd: ($: {
        annotation: Annotation
    }) => p.IValue<null>
}

export interface ArrayHandler<Annotation> {
    element: () => ValueHandler<Annotation>
    arrayEnd: ($: {
        annotation: Annotation
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
}) => ObjectHandler<Annotation>

export type OnArray<Annotation> = ($: {
    data: ArrayData
    annotation: Annotation
}) => ArrayHandler<Annotation>

export type OnSimpleValue<Annotation> = ($: {
    data: SimpleValueData2
    annotation: Annotation
}) => p.IValue<boolean>


export type OnTaggedUnion<Annotation> = ($: {
    annotation: Annotation
}) => TaggedUnionHandler<Annotation>
export type OnOption<Annotation> = ($: {
    data: OptionData
    annotation: Annotation
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
