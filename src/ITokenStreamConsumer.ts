import * as p from "pareto"
import { Location, Range } from "./location"

export type OnDataReturnValue = boolean | p.ISafePromise<boolean>

export enum TokenStreamConsumerDataType {
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

export interface IStreamConsumer<DataType, EndDataType> {
    onData(data: DataType): OnDataReturnValue
    onEnd(aborted: boolean, data: EndDataType): void
}

export type ITokenStreamConsumer = IStreamConsumer<TokenStreamConsumerData, Location>