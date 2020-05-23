import { Location, Range } from "./location"

export interface IParser {
    onSnippet(chunk: string, begin: number, end: number): void
    onLineCommentBegin(range: Range): void
    onLineCommentEnd(location: Location | null): void

    onBlockCommentBegin(range: Range): void
    onBlockCommentEnd(range: Range | null): void //pauser can be null for unterminated comments

    onUnquotedTokenBegin(location: Location): void
    onUnquotedTokenEnd(location: Location | null): void

    onQuotedStringBegin(range: Range, quote: string): void
    onQuotedStringEnd(range: Range, quote: string | null | null): void //quote can be null for unterminated strings

    onPunctuation(char: number, range: Range): void

    onNewLine(range: Range | null): void
    onWhitespaceBegin(location: Location): void
    onWhitespaceEnd(location: Location | null): void

    onEnd(location: Location): void
}