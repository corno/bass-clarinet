import { Range } from "./location"
import { SimpleValueData, OverheadToken } from "./Token"

export enum TreeEventType {
    CloseArray,
    CloseObject,
    Colon,
    Comma,
    OpenArray,
    OpenObject,
    Overhead,
    SimpleValue,
    TaggedUnion,
}

export type ArrayOpenData = {
    openCharacter: "[" | "<"
}

export type ArrayCloseData = {
    closeCharacter: "]" | ">"
}

export type ObjectOpenData = {
    openCharacter: "(" | "{"
}

export type ObjectCloseData = {
    closeCharacter: ")" | "}"
}

/**
 * A Document has a Header and a Body. The body can produce the following events
 */
export type TreeEvent = {
    range: Range
    type:
    | [TreeEventType.CloseArray, ArrayCloseData]
    | [TreeEventType.CloseObject, ObjectCloseData]
    | [TreeEventType.Colon, {
        //
    }]
    | [TreeEventType.Comma, {
        //
    }]
    | [TreeEventType.OpenArray, ArrayOpenData]
    | [TreeEventType.OpenObject, ObjectOpenData]
    | [TreeEventType.Overhead, OverheadToken]
    | [TreeEventType.SimpleValue, SimpleValueData]
    | [TreeEventType.TaggedUnion, {
        //
    }]
}
