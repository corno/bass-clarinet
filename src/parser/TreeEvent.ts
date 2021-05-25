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

export type TreeEvent = {
    tokenString: string
    range: Range
    type:
    | [TreeEventType.CloseArray]
    | [TreeEventType.CloseObject]
    | [TreeEventType.Colon]
    | [TreeEventType.Comma]
    | [TreeEventType.OpenArray]
    | [TreeEventType.OpenObject]
    | [TreeEventType.Overhead, OverheadToken]
    | [TreeEventType.SimpleValue, SimpleValueData]
    | [TreeEventType.TaggedUnion, {
        //
    }]
}
