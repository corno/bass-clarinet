import * as p from "pareto"
import { ArrayData, ObjectData, StringValueData } from "./handlers";

export enum TreeEventType {
    CloseArray,
    CloseObject,
    OpenArray,
    OpenObject,
    StringValue,
    Identifier,
    TaggedUnion,
}

export type TreeEvent<Annotation> = {
    annotation: Annotation
    type:
    | [TreeEventType.CloseArray]
    | [TreeEventType.CloseObject]
    | [TreeEventType.OpenArray, ArrayData]
    | [TreeEventType.OpenObject, ObjectData]
    | [TreeEventType.StringValue, StringValueData]
    | [TreeEventType.Identifier, {
        name: string
    }]
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
export type ITreeParserEventConsumer<Annotation, ReturnType, ErrorType> = p.IUnsafeStreamConsumer<TreeEvent<Annotation>, Annotation, ReturnType, ErrorType>