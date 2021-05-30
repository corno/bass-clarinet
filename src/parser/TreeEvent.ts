import { OverheadToken, StringData } from "../treeParser/api"
import { Range } from "./location"

export enum TreeEventType {
    CloseArray,
    CloseObject,
    Colon,
    Comma,
    OpenArray,
    OpenObject,
    Overhead,
    String,
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
    | [TreeEventType.String, StringData]
    | [TreeEventType.TaggedUnion, {
        //
    }]
}
