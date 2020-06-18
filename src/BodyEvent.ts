import { Range } from "./location"
import { CommentData, SimpleValueData, WhiteSpaceData } from "./Token"

export enum ParserEventType {
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

export type BodyEvent = {
    range: Range
    type:
    | [ParserEventType.BlockComment, CommentData]
    | [ParserEventType.CloseArray, CloseData]
    | [ParserEventType.CloseObject, CloseData]
    | [ParserEventType.Colon, {
        //
    }]
    | [ParserEventType.Comma, {
        //
    }]
    | [ParserEventType.LineComment, CommentData]
    | [ParserEventType.NewLine, {
        //
    }]
    | [ParserEventType.OpenArray, OpenData]
    | [ParserEventType.OpenObject, OpenData]
    | [ParserEventType.SimpleValue, SimpleValueData]
    | [ParserEventType.TaggedUnion, {
        //
    }]
    | [ParserEventType.WhiteSpace, WhiteSpaceData]
}
