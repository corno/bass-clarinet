import * as p from "pareto"
import { Range } from "../location"
import {
    SimpleValueData,
    OpenData,
    CloseData,
} from "../IParserEventConsumer"

export type PreData = {
    comments: Comment[]
    indentation: string
}

export enum AfterValueContext {
    OBJECT,
    ARRAY,
    END,
}

export type ObjectHandler = {
    property: (range: Range, key: string, preData: PreData) => RequiredValueHandler
    end: (range: Range, data: CloseData, preData: PreData) => void
}

export type ArrayHandler = {
    element: () => ValueHandler
    end: (range: Range, data: CloseData, preData: PreData) => void
}

export type TaggedUnionHandler = {
    option: OnOption
    missingOption: () => void
}

export type OnObject = (range: Range, data: OpenData, preData: PreData) => ObjectHandler

export type OnArray = (range: Range, data: OpenData, preData: PreData) => ArrayHandler

export type OnSimpleValue = (range: Range, data: SimpleValueData, preData: PreData) => p.DataOrPromise<boolean>

export type OnTaggedUnion = (range: Range, beginpreData: PreData) => TaggedUnionHandler
export type OnOption = (range: Range, option: string, optionpreData: PreData) => RequiredValueHandler

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