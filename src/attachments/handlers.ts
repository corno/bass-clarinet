import * as p from "pareto"
import { Range } from "../location"
import {
    SimpleValueData,
    OpenData,
    CloseData,
} from "../ParserEvent"

export type ContextData = {
    comments: Comment[]
    indentation: string
}

export enum AfterValueContext {
    OBJECT,
    ARRAY,
    END,
}

export type ObjectHandler = {
    property: (range: Range, key: string, contextData: ContextData) => RequiredValueHandler
    end: (range: Range, data: CloseData, contextData: ContextData) => void
}

export type ArrayHandler = {
    element: () => ValueHandler
    end: (range: Range, data: CloseData, contextData: ContextData) => void
}

export type TaggedUnionHandler = {
    option: OnOption
    missingOption: () => void
}

export type OnObject = (range: Range, data: OpenData, contextData: ContextData) => ObjectHandler

export type OnArray = (range: Range, data: OpenData, contextData: ContextData) => ArrayHandler

export type OnSimpleValue = (range: Range, data: SimpleValueData, contextData: ContextData) => p.IValue<boolean>

export type OnTaggedUnion = (range: Range, begincontextData: ContextData) => TaggedUnionHandler
export type OnOption = (range: Range, option: string, optioncontextData: ContextData) => RequiredValueHandler

export type OnMissing = () => void

export interface RequiredValueHandler {
    valueHandler: ValueHandler
    onMissing: OnMissing
}
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