import { Location, Range } from "./location"
import { IStreamConsumer } from "./IStreamConsumer"

export enum TokenStreamConsumerDataType {
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

export type TokenStreamConsumerData = {
    type:
    | [TokenStreamConsumerDataType.BlockCommentBegin, {
        range: Range
    }]
    | [TokenStreamConsumerDataType.BlockCommentEnd, {
        range: Range //| null
    }]
    | [TokenStreamConsumerDataType.LineCommentBegin, {
        range: Range
    }]
    | [TokenStreamConsumerDataType.LineCommentEnd, {
        location: Location //| null
    }]
    | [TokenStreamConsumerDataType.NewLine, {
        range: Range //| null
    }]
    | [TokenStreamConsumerDataType.Punctuation, {
        char: number
        range: Range
    }]
    | [TokenStreamConsumerDataType.QuotedStringBegin, {
        range: Range
        quote: string
    }]
    | [TokenStreamConsumerDataType.QuotedStringEnd, {
        range: Range
        quote: string | null
    }]
    | [TokenStreamConsumerDataType.Snippet, {
        chunk: string
        begin: number
        end: number
    }]
    | [TokenStreamConsumerDataType.UnquotedTokenBegin, {
        location: Location
    }]
    | [TokenStreamConsumerDataType.UnquotedTokenEnd, {
        location: Location //| null
    }]
    | [TokenStreamConsumerDataType.WhiteSpaceBegin, {
        location: Location
    }]
    | [TokenStreamConsumerDataType.WhiteSpaceEnd, {
        location: Location //| null
    }]
}

export type ITokenStreamConsumer = IStreamConsumer<TokenStreamConsumerData, Location>