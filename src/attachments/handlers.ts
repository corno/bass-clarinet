import { Range } from "../location"
import {
    OpenData,
    CloseData,
    PropertyData,
    SimpleValueData,
    TaggedUnionData,
} from "../IDataSubscriber"

export enum AfterValueContext {
    OBJECT,
    ARRAY,
    END,
}

export type ObjectHandler = {
    property: (key: string, metaData: PropertyData, comments: Comment[]) => ValueHandler
    end: (metaData: CloseData, comments: Comment[]) => void
}

export type ArrayHandler = {
    element: () => ValueHandler
    end: (metaData: CloseData, comments: Comment[]) => void
}

export type OnObject = (metaData: OpenData, comments: Comment[]) => ObjectHandler

export type OnArray = (metaData: OpenData, comments: Comment[]) => ArrayHandler

export type OnSimpleValue = (value: string, metaData: SimpleValueData, comments: Comment[]) => void

export type OnTaggedUnion = (option: string, metaData: TaggedUnionData, beginComments: Comment[], optionComments: Comment[]) => ValueHandler

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