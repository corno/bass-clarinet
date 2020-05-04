import { Range } from "../location"
import {
    OpenData,
    CloseData,
    PropertyData,
    StringData,
    TaggedUnionData,
    OptionData,
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
    property: (key: string, metaData: PropertyData, preData: PreData) => ExpectedValueHandler
    end: (metaData: CloseData, preData: PreData) => void
}

export type ExpectedValueHandler = {
    onValue: ValueHandler
    onMissing: () => void
}

export type ArrayHandler = {
    element: () => ValueHandler
    end: (metaData: CloseData, preData: PreData) => void
}

export type TaggedUnionHandler = {
    onOption: OnOption
    onMissingOption: () => void
}

export type OnObject = (metaData: OpenData, preData: PreData) => ObjectHandler

export type OnArray = (metaData: OpenData, preData: PreData) => ArrayHandler

export type OnSimpleValue = (value: string, metaData: StringData, preData: PreData) => void

export type OnTaggedUnion = (metaData: TaggedUnionData, beginpreData: PreData) => TaggedUnionHandler
export type OnOption = (option: string, optionData: OptionData, optionpreData: PreData) => ExpectedValueHandler

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