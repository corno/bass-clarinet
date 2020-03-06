import { Range } from "../location"
import { Pauser } from "../parserAPI"

export type EndData = {
    end: Range
    closeCharacter: string
    comments: Comment[]
}

export type PropertyData = {
    keyRange: Range
    comments: Comment[]
}

export type ObjectHandler = {
    property: (key: string, metaData: PropertyData) => ValueHandler
    end: (metaData: EndData) => void
}

export type ArrayHandler = {
    element: () => ValueHandler
    end: (metaData: EndData) => void
}

export type BeginData = {
    start: Range
    openCharacter: string
    comments: Comment[]
    pauser: Pauser
}

export type OnObject = (metaData: BeginData) => ObjectHandler

export type OnArray = (metaData: BeginData) => ArrayHandler

export type SimpleValueData = {
    quoted: boolean
    range: Range
    comments: Comment[]
    pauser: Pauser
}

export type OnSimpleValue = (value: string, metaData: SimpleValueData) => void

export type TaggedUnionData = {
    start: Range
    tuComments: Comment[]
    optionRange: Range
    optionComments: Comment[]
    pauser: Pauser
}

export type OnTaggedUnion = (option: string, metaData: TaggedUnionData) => ValueHandler

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