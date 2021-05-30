import * as p from "pareto"
import { OverheadToken, StringData } from "./ITreeParser";
import { Location, Range } from "../location"

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


/**
 * a TextParserEventConsumer is a IStreamConsumer.
 * the chunks are the individual TreeEvent's.
 * at the end, the location of the last character is sent ('Location').
 * The ReturnType and ErrorType are determined by the specific implementation.
 */
 export type ITreeParserEventConsumer<ReturnType, ErrorType> = p.IUnsafeStreamConsumer<TreeEvent, Location, ReturnType, ErrorType>