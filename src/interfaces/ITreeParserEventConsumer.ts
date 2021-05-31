import * as p from "pareto"
import { OverheadToken } from "./ITreeParser";
import { Location, Range } from "../location"
import { StringValueData } from "./handlers";

export enum TreeEventType {
    CloseArray,
    CloseObject,
    Colon,
    Comma,
    OpenArray,
    OpenObject,
    Overhead,
    StringValue,
    Identifier,
    Option,
    TaggedUnion,
}

export type TreeEvent = {
    tokenString: string
    indentation: string
    range: Range
    type:
    | [TreeEventType.CloseArray]
    | [TreeEventType.CloseObject]
    | [TreeEventType.Colon]
    | [TreeEventType.Comma]
    | [TreeEventType.OpenArray]
    | [TreeEventType.OpenObject]
    | [TreeEventType.Overhead, OverheadToken]
    | [TreeEventType.StringValue, StringValueData]
    | [TreeEventType.Identifier, {
        name: string
    }]
    | [TreeEventType.TaggedUnion, {
        //
    }]
}

export type EndData = {
    location: Location
    indentation: string
}


/**
 * a TextParserEventConsumer is a IStreamConsumer.
 * the chunks are the individual TreeEvent's.
 * at the end, the location of the last character is sent ('Location').
 * The ReturnType and ErrorType are determined by the specific implementation.
 */
 export type ITreeParserEventConsumer<ReturnType, ErrorType> = p.IUnsafeStreamConsumer<TreeEvent, EndData, ReturnType, ErrorType>