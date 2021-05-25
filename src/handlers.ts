import * as p from "pareto"

export type PropertyData<Annotation> = {
    key: string
    annotation: Annotation
}

export type ObjectEndData<Annotation> = {
    annotation: Annotation
}

export type ObjectHandler<Annotation> = {
    onData: (propertyData: PropertyData<Annotation>) => p.IValue<RequiredValueHandler<Annotation>>
    onEnd: (objectEndData: ObjectEndData<Annotation>) => p.IValue<null>
}

export type ArrayEndData<Annotation> = {
    annotation: Annotation
}

export type ArrayHandler<Annotation> = {
    onData: () => ValueHandler<Annotation>
    onEnd: (arrayEndData: ArrayEndData<Annotation>) => p.IValue<null>
}

export type TaggedUnionHandler<Annotation> = {
    option: OnOption<Annotation>
    missingOption: () => void
    end: () => void
}

export type ObjectBeginData<Annotation> = {
    type:
    | ["verbose type"]
    | ["dictionary"]
    annotation: Annotation
}

export type OnObject<Annotation> = (data: ObjectBeginData<Annotation>) => ObjectHandler<Annotation>

export type ArrayBeginData<Annotation> = {
    type:
    | ["shorthand type"]
    | ["list"]
    annotation: Annotation
}

export type OnArray<Annotation> = (data: ArrayBeginData<Annotation>) => ArrayHandler<Annotation>

export type Wrapper =
    | ["none"]
    | ["backtick"]
    | ["quote"]

export type SimpleValueData2<Annotation> = {
    wrapper: Wrapper
    value: string
    annotation: Annotation
}

export type OnSimpleValue<Annotation> = (data: SimpleValueData2<Annotation>) => p.IValue<boolean>

export type TaggedUnionData<Annotation> = {
    annotation: Annotation
}

export type OptionData<Annotation> = {
    option: string
    annotation: Annotation
}

export type OnTaggedUnion<Annotation> = (data: TaggedUnionData<Annotation>) => TaggedUnionHandler<Annotation>
export type OnOption<Annotation> = (data: OptionData<Annotation>) => RequiredValueHandler<Annotation>

export type OnMissing = () => void

export interface RequiredValueHandler<Annotation> {
    onExists: ValueHandler<Annotation>
    onMissing: OnMissing
}

export interface ValueHandler<Annotation> {
    object: OnObject<Annotation>
    array: OnArray<Annotation>
    simpleValue: OnSimpleValue<Annotation>
    taggedUnion: OnTaggedUnion<Annotation>
}
