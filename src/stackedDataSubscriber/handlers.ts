import { Range } from "../location"

export type ObjectHandler = {
    property: (key: string, keyRange: Range, comments: Comment[]) => ValueHandler
    end: (end: Range, closeCharacter: string, comments: Comment[]) => void
}

export type ArrayHandler = {
    element: (start: Range, comments: Comment[]) => ValueHandler
    end: (end: Range, closeCharacter: string, comments: Comment[]) => void
}

export type OnObject = (start: Range, openCharacter: string, comments: Comment[]) => ObjectHandler
export type OnArray = (start: Range, openCharacter: string, comments: Comment[]) => ArrayHandler
export type OnNumber = (value: number, range: Range, comments: Comment[]) => void
export type OnBoolean = (value: boolean, range: Range, comments: Comment[]) => void
export type OnString = (value: string, range: Range, comments: Comment[]) => void
export type OnNull = (range: Range, comments: Comment[]) => void
export type OnTaggedUnion = (option: string, start: Range, tuComments: Comment[], optionRange: Range, optionComments: Comment[]) => ValueHandler

export interface ValueHandler {
    object: OnObject
    array: OnArray
    boolean: OnBoolean
    string: OnString
    number: OnNumber
    null: OnNull
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