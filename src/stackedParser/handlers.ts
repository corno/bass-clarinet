import * as p from "pareto"
import { Range } from "../parser/location"
import {
    ArrayOpenData,
    ArrayCloseData,
    ObjectOpenData,
    ObjectCloseData,
} from "../parser/TreeEvent"
import { SimpleValueData } from "../parser/Token"

export type BeforeContextData = {
    comments: Comment[]
    indentation: string | null
}

export type ContextData = {
    before: BeforeContextData
    lineCommentAfter: null | Comment
}

export type PropertyData = {
    keyRange: Range
    key: string
    contextData: ContextData
}

export type ObjectEndData = {
    range: Range
    data: ObjectCloseData
    contextData: ContextData
}

export type ObjectHandler = {
    onData: (propertyData: PropertyData) => p.IValue<RequiredValueHandler>
    onEnd: (objectEndData: ObjectEndData) => p.IValue<null>
}

export type ArrayEndData = {
    range: Range
    data: ArrayCloseData
    contextData: ContextData
}

export type ArrayHandler = {
    onData: (range: Range) => OnValue
    onEnd: (arrayEndData: ArrayEndData) => p.IValue<null>
}

export type TaggedUnionHandler = {
    option: OnOption
    missingOption: () => void
    end: () => void
}

export type OnObject = (range: Range, data: ObjectOpenData) => ObjectHandler

export type OnArray = (range: Range, data: ArrayOpenData) => ArrayHandler

export type OnSimpleValue = (range: Range, data: SimpleValueData) => p.IValue<boolean>

export type OnTaggedUnion = (range: Range) => TaggedUnionHandler
export type OnOption = (range: Range, option: string, optioncontextData: ContextData) => RequiredValueHandler

export type OnMissing = () => void

export interface RequiredValueHandler {
    onExists: OnValue
    onMissing: OnMissing
}

export type OnValue = (contextData: ContextData) => ValueHandler

export interface ValueHandler {
    object: OnObject
    array: OnArray
    simpleValue: OnSimpleValue
    taggedUnion: OnTaggedUnion
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