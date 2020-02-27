import { Range } from "../location"
import { Pauser } from "../parserAPI"

export type ObjectHandler = {
    property: (key: string, keyRange: Range, comments: Comment[]) => ValueHandler
    end: (end: Range, closeCharacter: string, comments: Comment[]) => void
}

export type ArrayHandler = {
    element: (start: Range, comments: Comment[]) => ValueHandler
    end: (end: Range, closeCharacter: string, comments: Comment[]) => void
}

export type OnObject = (start: Range, openCharacter: string, comments: Comment[], pauser: Pauser) => ObjectHandler
export type OnArray = (start: Range, openCharacter: string, comments: Comment[], pauser: Pauser) => ArrayHandler
export type OnNumber = (value: number, range: Range, comments: Comment[], pauser: Pauser) => void
export type OnBoolean = (value: boolean, range: Range, comments: Comment[], pauser: Pauser) => void
export type OnString = (value: string, range: Range, comments: Comment[], pauser: Pauser) => void
export type OnNull = (range: Range, comments: Comment[], pauser: Pauser) => void
export type OnTaggedUnion = (option: string, start: Range, tuComments: Comment[], optionRange: Range, optionComments: Comment[], pauser: Pauser) => ValueHandler

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