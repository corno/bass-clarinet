import { printRange, printLocation } from "../location"
import { PreToken, PreTokenDataType } from "../interfaces/IPreTokenStreamConsumer"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
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
            const wrapper = ((): string => {
                switch ($.type[0]) {
                    case "apostrophed": return "'"
                    case "multiline": return "`"
                    case "quoted": return "\""
                    default: return assertUnreachable($.type[0])
                }
            })()
            return `WrappedStringBegin: '${wrapper}' (${printRange($.range)})`
        }
        case PreTokenDataType.WrappedStringEnd: {
            const $ = tokenData.type[1]
            return `WrappedStringEnd: ${$.wrapper === null ? 'n/a' : `'${$.wrapper}'`} (${printRange($.range)})`
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