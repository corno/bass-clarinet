import { Location, Range, printRange, printLocation } from "./location"

export type Quote = "'" | "\""

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
    QuotedStringBegin,
    QuotedStringEnd,
    Snippet,
    UnquotedTokenBegin,
    UnquotedTokenEnd,
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
        case PreTokenDataType.QuotedStringBegin: {
            const $ = tokenData.type[1]
            return `QuotedStringBegin: '${$.quote}' (${printRange($.range)})`
        }
        case PreTokenDataType.QuotedStringEnd: {
            const $ = tokenData.type[1]
            return `QuotedStringEnd: ${$.quote === null ? 'n/a': `'${$.quote}'`} (${printRange($.range)})`
        }
        case PreTokenDataType.Snippet: {
            const $ = tokenData.type[1]
            return `Snippet ${$.begin}-${$.end}`
        }
        case PreTokenDataType.UnquotedTokenBegin: {
            const $ = tokenData.type[1]
            return `UnquotedTokenBegin (${printLocation($.location)})`
        }
        case PreTokenDataType.UnquotedTokenEnd: {
            const $ = tokenData.type[1]
            return `UnquotedTokenEnd (${printLocation($.location)})`
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
    | [PreTokenDataType.QuotedStringBegin, {
        range: Range
        quote: Quote
    }]
    | [PreTokenDataType.QuotedStringEnd, {
        range: Range
        quote: string | null
    }]
    | [PreTokenDataType.Snippet, {
        chunk: string
        begin: number
        end: number
    }]
    | [PreTokenDataType.UnquotedTokenBegin, {
        location: Location
    }]
    | [PreTokenDataType.UnquotedTokenEnd, {
        location: Location //| null
    }]
    | [PreTokenDataType.WhiteSpaceBegin, {
        location: Location
    }]
    | [PreTokenDataType.WhiteSpaceEnd, {
        location: Location //| null
    }]
}