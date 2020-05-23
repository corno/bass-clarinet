import { Location, Range } from "./location"
import * as p from "pareto"

export type PropertyData = {
    keyRange: Range
}

export type SimpleValueData = {
    value: string
    quote: string | null
    terminated: boolean | null
}

export type WhiteSpaceData = {
    value: string
}

export type CommentData = {
    comment: string
    innerRange: Range //without the open and close tokens:
    indentation: null | string
}

export enum DataType {
    BlockComment,
    CloseArray,
    CloseObject,
    Colon,
    Comma,
    LineComment,
    NewLine,
    OpenArray,
    OpenObject,
    SimpleValue,
    TaggedUnion,
    WhiteSpace
}

export type OpenData = {
    openCharacter: string
}

export type CloseData = {
    closeCharacter: string
}

export type Data = {
    range: Range
    type:
    | [DataType.BlockComment, CommentData]
    | [DataType.CloseArray, CloseData]
    | [DataType.CloseObject, CloseData]
    | [DataType.Colon, {
        //
    }]
    | [DataType.Comma, {
        //
    }]
    | [DataType.LineComment, CommentData]
    | [DataType.NewLine, {
        //
    }]
    | [DataType.OpenArray, OpenData]
    | [DataType.OpenObject, OpenData]
    | [DataType.SimpleValue, SimpleValueData]
    | [DataType.TaggedUnion, {
        //
    }]
    | [DataType.WhiteSpace, WhiteSpaceData]
}

export interface IDataSubscriber {
    onData(data: Data): boolean | p.ISafePromise<boolean>
    onEnd(location: Location): void
}

