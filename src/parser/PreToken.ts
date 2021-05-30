import { Location, Range, printRange, printLocation } from "./location"

export type WrappedStringType = 
| ["apostrophed", {

}]
| ["quoted", {

}]
| ["multiline", {
    previousLines: string[]
}]

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export enum PreTokenDataType {
    BlockCommentBegin,
    BlockCommentEnd,
    LineCommentBegin,
    LineCommentEnd,
    NewLine,
    Punctuation,
    WrappedStringBegin,
    WrappedStringEnd,
    Snippet,
    NonWrappedStringBegin,
    NonWrappedStringEnd,
    WhiteSpaceBegin,
    WhiteSpaceEnd,
}

export function printPreTokenData(tokenData: PreToken): string {
    switch (tokenData.type[0]) {
        case PreTokenDataType.BlockCommentBegin: {
            const $ = tokenData.type[1]
            return `BlockCommentBegin (${printRange($.range)})`
        }
        case PreTokenDataType.BlockCommentEnd: {
            const $ = tokenData.type[1]
            return `BlockCommentEnd (${printRange($.range)})`
        }
        case PreTokenDataType.LineCommentBegin: {
            const $ = tokenData.type[1]
            return `LineCommentBegin (${printRange($.range)})`
        }
        case PreTokenDataType.LineCommentEnd: {
            const $ = tokenData.type[1]
            return `LineCommentEnd (${printLocation($.location)})`
        }
        case PreTokenDataType.NewLine: {
            const $ = tokenData.type[1]
            return `NewLine (${printRange($.range)})`
        }
        case PreTokenDataType.Punctuation: {
            const $ = tokenData.type[1]
            return `Punctuation: '${String.fromCharCode($.char)}' (${printRange($.range)})`
        }
        case PreTokenDataType.WrappedStringBegin: {
            const $ = tokenData.type[1]
            return `WrappedStringBegin: '${$.type}' (${printRange($.range)})`
        }
        case PreTokenDataType.WrappedStringEnd: {
            const $ = tokenData.type[1]
            return `WrappedStringEnd: ${$.wrapper === null ? 'n/a': `'${$.wrapper}'`} (${printRange($.range)})`
        }
        case PreTokenDataType.Snippet: {
            const $ = tokenData.type[1]
            return `Snippet ${$.begin}-${$.end}`
        }
        case PreTokenDataType.NonWrappedStringBegin: {
            const $ = tokenData.type[1]
            return `NonWrappedStringBegin (${printLocation($.location)})`
        }
        case PreTokenDataType.NonWrappedStringEnd: {
            const $ = tokenData.type[1]
            return `NonWrappedStringEnd (${printLocation($.location)})`
        }
        case PreTokenDataType.WhiteSpaceBegin: {
            const $ = tokenData.type[1]
            return `WhiteSpaceBegin (${printLocation($.location)})`
        }
        case PreTokenDataType.WhiteSpaceEnd: {
            const $ = tokenData.type[1]
            return `WhiteSpaceEnd (${printLocation($.location)})`
        }
        default:
            return assertUnreachable(tokenData.type[0])
    }
}

/**
 * A PreToken is a low level token
 */
export type PreToken = {
    type:
    | [PreTokenDataType.BlockCommentBegin, {
        range: Range
    }]
    | [PreTokenDataType.BlockCommentEnd, {
        range: Range //| null
    }]
    | [PreTokenDataType.LineCommentBegin, {
        range: Range
    }]
    | [PreTokenDataType.LineCommentEnd, {
        location: Location //| null
    }]
    | [PreTokenDataType.NewLine, {
        range: Range //| null
    }]
    | [PreTokenDataType.Punctuation, {
        char: number
        range: Range
    }]
    | [PreTokenDataType.WrappedStringBegin, {
        range: Range
        type: WrappedStringType
    }]
    | [PreTokenDataType.WrappedStringEnd, {
        range: Range
        wrapper: string | null
    }]
    | [PreTokenDataType.Snippet, {
        chunk: string
        begin: number
        end: number
    }]
    | [PreTokenDataType.NonWrappedStringBegin, {
        location: Location
    }]
    | [PreTokenDataType.NonWrappedStringEnd, {
        location: Location //| null
    }]
    | [PreTokenDataType.WhiteSpaceBegin, {
        location: Location
    }]
    | [PreTokenDataType.WhiteSpaceEnd, {
        location: Location //| null
    }]
}