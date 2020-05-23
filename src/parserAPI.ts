import { Location, Range } from "./location"

export enum ParserDataType {
    Snippet,
    LineCommentBegin,
    LineCommentEnd,
    BlockCommentBegin,
    BlockCommentEnd,
    UnquotedTokenBegin,
    UnquotedTokenEnd,
    QuotedStringBegin,
    QuotedStringEnd,
    Punctuation,
    NewLine,
    WhiteSpaceBegin,
    WhiteSpaceEnd,
}

export type ParserData = {
    type:
    | [ParserDataType.BlockCommentBegin, {
        range: Range
    }]
    | [ParserDataType.BlockCommentEnd, {
        range: Range //| null
    }]
    | [ParserDataType.LineCommentBegin, {
        range: Range
    }]
    | [ParserDataType.LineCommentEnd, {
        location: Location //| null
    }]
    | [ParserDataType.NewLine, {
        range: Range //| null
    }]
    | [ParserDataType.Punctuation, {
        char: number
        range: Range
    }]
    | [ParserDataType.QuotedStringBegin, {
        range: Range
        quote: string
    }]
    | [ParserDataType.QuotedStringEnd, {
        range: Range
        quote: string | null
    }]
    | [ParserDataType.Snippet, {
        chunk: string
        begin: number
        end: number
    }]
    | [ParserDataType.UnquotedTokenBegin, {
        location: Location
    }]
    | [ParserDataType.UnquotedTokenEnd, {
        location: Location //| null
    }]
    | [ParserDataType.WhiteSpaceBegin, {
        location: Location
    }]
    | [ParserDataType.WhiteSpaceEnd, {
        location: Location //| null
    }]
}

export interface IParser {
    onData(data: ParserData): void
    onEnd(location: Location): void
}