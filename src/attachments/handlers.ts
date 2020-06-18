import * as p from "pareto"
import { Range } from "../location"
import {
    OpenData,
    CloseData,
} from "../BodyEvent"
import { SimpleValueData } from "../Token"

export type ContextData = {
    commentsBefore: Comment[]
    indentation: string
    lineCommentAfter: null | Comment
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
    element: () => OnValue
    end: (range: Range, data: CloseData, contextData: ContextData) => void
}

export type TaggedUnionHandler = {
    option: OnOption
    missingOption: () => void
}

export type OnObject = (range: Range, data: OpenData) => ObjectHandler

export type OnArray = (range: Range, data: OpenData) => ArrayHandler

export type OnSimpleValue = (range: Range, data: SimpleValueData) => p.IValue<boolean>

export type OnTaggedUnion = (range: Range) => TaggedUnionHandler
export type OnOption = (range: Range, option: string, optioncontextData: ContextData) => RequiredValueHandler

export type OnMissing = () => void

export interface RequiredValueHandler {
    onValue: OnValue
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