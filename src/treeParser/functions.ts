import * as p from "pareto"
import { ITreeParser, OverheadToken, StringData } from "./api";
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
 export type TreeParserEventConsumer<ReturnType, ErrorType> = p.IUnsafeStreamConsumer<TreeEvent, Location, ReturnType, ErrorType>

export type TreeParserErrorType =
    | ["unexpected end of document", {
        "still in":
        | ["array"]
        | ["object"]
        | ["tagged union"]
    }]
    | ["unexpected '!'"]
    | ["not in an object"]
    | ["not in an array"]
    | ["missing property value"]
    | ["expected option"]
    | ["unknown punctuation", {
        found: string
    }]

export type TreeParserError = {
    type: TreeParserErrorType
}

export type CreateTreeParser<ReturnType, ErrorType> = (
    onerror: (error: TreeParserError, range: Range) => void,
    eventsConsumer: TreeParserEventConsumer<ReturnType, ErrorType>
) => ITreeParser<ReturnType, ErrorType>