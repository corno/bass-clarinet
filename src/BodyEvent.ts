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

export type OpenData = {
    openCharacter: string
}

export type CloseData = {
    closeCharacter: string
}

/**
 * A Document has a Header and a Body. The body can produce the following events
 */
export type BodyEvent = {
    range: Range
    type:
    | [BodyEventType.CloseArray, CloseData]
    | [BodyEventType.CloseObject, CloseData]
    | [BodyEventType.Colon, {
        //
    }]
    | [BodyEventType.Comma, {
        //
    }]
    | [BodyEventType.OpenArray, OpenData]
    | [BodyEventType.OpenObject, OpenData]
    | [BodyEventType.Overhead, OverheadToken]
    | [BodyEventType.SimpleValue, SimpleValueData]
    | [BodyEventType.TaggedUnion, {
        //
    }]
}
