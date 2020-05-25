import { Location, Range } from "./location"

export enum TokenDataType {
    BlockCommentBegin,
    BlockCommentEnd,
    LineCommentBegin,
    LineCommentEnd,
    NewLine,
    Punctuation,
    QuotedStringBegin,
    QuotedStringEnd,
    Snippet,
    UnquotedTokenBegin,
    UnquotedTokenEnd,
    WhiteSpaceBegin,
    WhiteSpaceEnd,
}

export type TokenData = {
    type:
    | [TokenDataType.BlockCommentBegin, {
        range: Range
    }]
    | [TokenDataType.BlockCommentEnd, {
        range: Range //| null
    }]
    | [TokenDataType.LineCommentBegin, {
        range: Range
    }]
    | [TokenDataType.LineCommentEnd, {
        location: Location //| null
    }]
    | [TokenDataType.NewLine, {
        range: Range //| null
    }]
    | [TokenDataType.Punctuation, {
        char: number
        range: Range
    }]
    | [TokenDataType.QuotedStringBegin, {
        range: Range
        quote: string
    }]
    | [TokenDataType.QuotedStringEnd, {
        range: Range
        quote: string | null
    }]
    | [TokenDataType.Snippet, {
        chunk: string
        begin: number
        end: number
    }]
    | [TokenDataType.UnquotedTokenBegin, {
        location: Location
    }]
    | [TokenDataType.UnquotedTokenEnd, {
        location: Location //| null
    }]
    | [TokenDataType.WhiteSpaceBegin, {
        location: Location
    }]
    | [TokenDataType.WhiteSpaceEnd, {
        location: Location //| null
    }]
}