import { Location, Range, printRange, printLocation } from "./location"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

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

export function printTokenData(tokenData: TokenData): string {
    switch (tokenData.type[0]) {
        case TokenDataType.BlockCommentBegin: {
            const $ = tokenData.type[1]
            return `BlockCommentBegin (${printRange($.range)})`
        }
        case TokenDataType.BlockCommentEnd: {
            const $ = tokenData.type[1]
            return `BlockCommentEnd (${printRange($.range)})`
        }
        case TokenDataType.LineCommentBegin: {
            const $ = tokenData.type[1]
            return `LineCommentBegin (${printRange($.range)})`
        }
        case TokenDataType.LineCommentEnd: {
            const $ = tokenData.type[1]
            return `LineCommentEnd (${printLocation($.location)})`
        }
        case TokenDataType.NewLine: {
            const $ = tokenData.type[1]
            return `NewLine (${printRange($.range)})`
        }
        case TokenDataType.Punctuation: {
            const $ = tokenData.type[1]
            return `Punctuation: '${String.fromCharCode($.char)}' (${printRange($.range)})`
        }
        case TokenDataType.QuotedStringBegin: {
            const $ = tokenData.type[1]
            return `QuotedStringBegin: '${$.quote}' (${printRange($.range)})`
        }
        case TokenDataType.QuotedStringEnd: {
            const $ = tokenData.type[1]
            return `QuotedStringEnd: ${$.quote === null ? 'n/a': `'${$.quote}'`} (${printRange($.range)})`
        }
        case TokenDataType.Snippet: {
            const $ = tokenData.type[1]
            return `Snippet ${$.begin}-${$.end}`
        }
        case TokenDataType.UnquotedTokenBegin: {
            const $ = tokenData.type[1]
            return `UnquotedTokenBegin (${printLocation($.location)})`
        }
        case TokenDataType.UnquotedTokenEnd: {
            const $ = tokenData.type[1]
            return `UnquotedTokenEnd (${printLocation($.location)})`
        }
        case TokenDataType.WhiteSpaceBegin: {
            const $ = tokenData.type[1]
            return `WhiteSpaceBegin (${printLocation($.location)})`
        }
        case TokenDataType.WhiteSpaceEnd: {
            const $ = tokenData.type[1]
            return `WhiteSpaceEnd (${printLocation($.location)})`
        }
        default:
            return assertUnreachable(tokenData.type[0])
    }
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