import { Range } from "./location"
import { SimpleValueData, OverheadToken } from "./Token"

export enum BodyEventType {
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
export type BodyEvent = {
    range: Range
    type:
    | [BodyEventType.CloseArray, ArrayCloseData]
    | [BodyEventType.CloseObject, ObjectCloseData]
    | [BodyEventType.Colon, {
        //
    }]
    | [BodyEventType.Comma, {
        //
    }]
    | [BodyEventType.OpenArray, ArrayOpenData]
    | [BodyEventType.OpenObject, ObjectOpenData]
    | [BodyEventType.Overhead, OverheadToken]
    | [BodyEventType.SimpleValue, SimpleValueData]
    | [BodyEventType.TaggedUnion, {
        //
    }]
}
