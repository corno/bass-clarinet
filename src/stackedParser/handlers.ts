import * as p from "pareto"
import { Range } from "../parser/location"
import {
    ArrayOpenData,
    ArrayCloseData,
    ObjectOpenData,
    ObjectCloseData,
} from "../parser/TreeEvent"
import { SimpleValueData } from "../parser/Token"

export type PropertyData<Annotation> = {
    key: string
    annotation: Annotation
}

export type ObjectEndData<Annotation> = {
    data: ObjectCloseData
    annotation: Annotation
}

export type ObjectHandler<Annotation> = {
    onData: (propertyData: PropertyData<Annotation>) => p.IValue<RequiredValueHandler<Annotation>>
    onEnd: (objectEndData: ObjectEndData<Annotation>) => p.IValue<null>
}

export type ArrayEndData<Annotation> = {
    data: ArrayCloseData
    annotation: Annotation
}

export type ArrayHandler<Annotation> = {
    onData: (range: Range) => OnValue<Annotation>
    onEnd: (arrayEndData: ArrayEndData<Annotation>) => p.IValue<null>
}

export type TaggedUnionHandler<Annotation> = {
    option: OnOption<Annotation>
    missingOption: () => void
    end: () => void
}

export type ObjectBeginData<Annotation> = {
    data: ObjectOpenData
    annotation: Annotation
}

export type OnObject<Annotation> = (data: ObjectBeginData<Annotation>) => ObjectHandler<Annotation>

export type ArrayBeginData<Annotation> = {
    data: ArrayOpenData
    annotation: Annotation
}

export type OnArray<Annotation> = (data: ArrayBeginData<Annotation>) => ArrayHandler<Annotation>

export type SimpleValueData2<Annotation> = {
    data: SimpleValueData
    annotation: Annotation
}

export type OnSimpleValue<Annotation> = (data: SimpleValueData2<Annotation>) => p.IValue<boolean>

export type TaggedUnionData<Annotation> = {
    range: Range
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
    onExists: OnValue<Annotation>
    onMissing: OnMissing
}

export type OnValue<Annotation> = () => ValueHandler<Annotation>

export interface ValueHandler<Annotation> {
    object: OnObject<Annotation>
    array: OnArray<Annotation>
    simpleValue: OnSimpleValue<Annotation>
    taggedUnion: OnTaggedUnion<Annotation>
}

export type Comment = {
    text: string
    outerRange: Range
    innerRange: Range
    type:
    | "block"
    | "line"
    indent: null | string
}