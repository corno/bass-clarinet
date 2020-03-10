import { Range } from "../location"
import {
    OpenData,
    CloseData,
    PropertyData,
    StringData,
    TaggedUnionData,
} from "../IDataSubscriber"

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
    property: (key: string, metaData: PropertyData, preData: PreData) => ValueHandler
    end: (metaData: CloseData, preData: PreData) => void
}

export type ArrayHandler = {
    element: () => ValueHandler
    end: (metaData: CloseData, preData: PreData) => void
}

export type OnObject = (metaData: OpenData, preData: PreData) => ObjectHandler

export type OnArray = (metaData: OpenData, preData: PreData) => ArrayHandler

export type OnSimpleValue = (value: string, metaData: StringData, preData: PreData) => void

export type OnTaggedUnion = (option: string, metaData: TaggedUnionData, beginpreData: PreData, optionpreData: PreData) => ValueHandler

export interface ValueHandler {
    object: OnObject
    array: OnArray
    simpleValue: OnSimpleValue
    taggedUnion: OnTaggedUnion
}

export type Comment = {
    text: string
    range: Range
    type:
    | "block"
    | "line"
    indent: null | string
}