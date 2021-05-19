/* eslint
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import {
    CurrentToken,
    CurrentTokenType,
    IndentationState,
    IndentationData,
    WhitespaceContext,
} from "./parserStateTypes"
import { Location, Range, getEndLocationFromRange, createRangeFromSingleLocation, createRangeFromLocations } from "./location"
import { PreTokenDataType, PreToken, Quote } from "./PreToken"
import { TokenType, Token, OverheadTokenType } from "./Token"
import { RangeError } from "../errors"
import { ITokenStreamConsumer } from "./ITokenStreamConsumer"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const DEBUG = false

class TokenizerStackPanicError extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

export interface TokenConsumer<ReturnType, ErrorType> {
    onData(token: Token): p.IValue<boolean>
    onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType>
}

export class Tokenizer<ReturnType, ErrorType> {
    private readonly parser: TokenConsumer<ReturnType, ErrorType>
    private currentToken: CurrentToken = [CurrentTokenType.NONE]
    private indentationState: IndentationData = [IndentationState.lineIsVirgin]
    constructor(consumer: TokenConsumer<ReturnType, ErrorType>) {
        this.parser = consumer
    }
    public onData(data: PreToken): p.IValue<boolean> {
        //const $ = this.getCurrentContext()

        switch (data.type[0]) {
            case PreTokenDataType.BlockCommentBegin: {
                const $ = data.type[1]
                return this.onBlockCommentBegin($.range)
            }
            case PreTokenDataType.BlockCommentEnd: {
                const $ = data.type[1]
                return this.onBlockCommentEnd($.range)
            }
            case PreTokenDataType.LineCommentBegin: {
                const $ = data.type[1]
                return this.onLineCommentBegin($.range)
            }
            case PreTokenDataType.LineCommentEnd: {
                const $ = data.type[1]
                return this.onLineCommentEnd($.location)
            }
            case PreTokenDataType.NewLine: {
                const $ = data.type[1]
                return this.onNewLine($.range)
            }
            case PreTokenDataType.Punctuation: {
                const $ = data.type[1]
                this.indentationState = [IndentationState.lineIsDitry]
                return this.parser.onData({
                    range: $.range,
                    type: [TokenType.Punctuation, {
                        char: $.char,
                    }],
                })
            }
            case PreTokenDataType.Snippet: {
                const $ = data.type[1]
                return this.onSnippet($.chunk, $.begin, $.end)
            }
            case PreTokenDataType.QuotedStringBegin: {
                const $ = data.type[1]
                return this.onQuotedStringBegin($.range, $.quote)
            }
            case PreTokenDataType.QuotedStringEnd: {
                const $ = data.type[1]
                return this.onQuotedStringEnd($.range, $.quote)
            }
            case PreTokenDataType.UnquotedTokenBegin: {
                const $ = data.type[1]
                return this.onUnquotedTokenBegin($.location)
            }
            case PreTokenDataType.UnquotedTokenEnd: {
                const $ = data.type[1]
                return this.onUnquotedTokenEnd($.location)
            }
            case PreTokenDataType.WhiteSpaceBegin: {
                const $ = data.type[1]
                return this.onWhitespaceBegin($.location)
            }
            case PreTokenDataType.WhiteSpaceEnd: {
                const $ = data.type[1]
                return this.onWhitespaceEnd($.location)
            }
            default:
                return assertUnreachable(data.type[0])
        }
    }
    public onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> {
        return this.parser.onEnd(aborted, location)
    }
    private onBlockCommentBegin(range: Range): p.IValue<boolean> {
        if (DEBUG) console.log(`onBlockCommentBegin`)

        this.setCurrentToken([CurrentTokenType.BLOCK_COMMENT, {
            commentNode: "",
            start: range,
            indentation: this.getIndentation(),
        }], range)

        this.indentationState = [IndentationState.lineIsDitry]
        return p.value(false)
    }
    private setCurrentToken(contextType: CurrentToken, range: Range) {
        if (this.currentToken[0] !== CurrentTokenType.NONE) {
            throw new TokenizerStackPanicError(`unexpected start of token`, range)
        }
        this.currentToken = contextType
    }
    private unsetCurrentToken(range: Range) {
        if (this.currentToken[0] === CurrentTokenType.NONE) {
            throw new TokenizerStackPanicError(`unexpected, parser is already in 'none' mode`, range)
        }
        this.currentToken = [CurrentTokenType.NONE]
    }
    private getIndentation(): null | string {
        switch (this.indentationState[0]) {
            case IndentationState.foundIndentation: {
                return this.indentationState[1].whitespaceNode
            }
            case IndentationState.lineIsVirgin: {
                return null
            }
            case IndentationState.lineIsDitry: {
                return null
            }
            default:
                return assertUnreachable(this.indentationState[0])
        }
    }
    private onBlockCommentEnd(end: Range): p.IValue<boolean> {
        if (DEBUG) console.log(`onBlockCommentEnd`)

        if (this.currentToken[0] !== CurrentTokenType.BLOCK_COMMENT) {
            throw new TokenizerStackPanicError(`Unexpected block comment end`, end)
        }
        const $ = this.currentToken[1]
        const endOfStart = getEndLocationFromRange($.start)
        const od = this.parser.onData({
            range: createRangeFromLocations(
                $.start.start,
                getEndLocationFromRange(end),
            ),
            type: [TokenType.Overhead, {
                type: [OverheadTokenType.Comment, {
                    comment: $.commentNode,
                    innerRange: createRangeFromLocations(
                        {
                            position: endOfStart.position,
                            line: endOfStart.line,
                            column: endOfStart.column,
                        },
                        {
                            position: end.start.position,
                            line: end.start.line,
                            column: end.start.column,
                        },
                    ),
                    indentation: $.indentation,
                    type: "block",
                }],
            }],
        })
        this.unsetCurrentToken(end)
        return od
    }
    private onUnquotedTokenBegin(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onUnquotedTokenBegin`)

        this.indentationState = [IndentationState.lineIsDitry]

        this.setCurrentToken([CurrentTokenType.UNQUOTED_TOKEN, { unquotedTokenNode: "", start: location }], createRangeFromSingleLocation(location))
        return p.value(false)
    }
    private onUnquotedTokenEnd(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onUnquotedTokenEnd`)

        if (this.currentToken[0] !== CurrentTokenType.UNQUOTED_TOKEN) {
            throw new TokenizerStackPanicError(`Unexpected unquoted token end`, createRangeFromSingleLocation(location))
        }
        const $ = this.currentToken[1]

        const $tok = this.currentToken[1]
        const value = $tok.unquotedTokenNode
        const range = createRangeFromLocations($.start, location)
        this.unsetCurrentToken(createRangeFromSingleLocation(location))
        return this.parser.onData({
            range: range,
            type: [TokenType.SimpleValue, {
                value: value,
                //startCharacter: $tok.startCharacter,
                terminated: null,
                quote: null,
            }],
        })
    }

    private onWhitespaceBegin(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onWhitespaceBegin`)
        const $: WhitespaceContext = { whitespaceNode: "", start: location }

        if (this.indentationState[0] === IndentationState.lineIsVirgin) {

            this.indentationState = [IndentationState.foundIndentation, $]
        }
        this.setCurrentToken([CurrentTokenType.WHITESPACE, $], createRangeFromSingleLocation(location))
        return p.value(false)
    }
    private onWhitespaceEnd(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onWhitespaceEnd`)

        if (this.currentToken[0] !== CurrentTokenType.WHITESPACE) {
            throw new TokenizerStackPanicError(`Unexpected whitespace end`, createRangeFromSingleLocation(location))
        }
        const $ = this.currentToken[1]
        const range = createRangeFromLocations($.start, location)
        const od = this.parser.onData({
            range: range,
            type: [TokenType.Overhead, {
                type: [OverheadTokenType.WhiteSpace, {
                    value: $.whitespaceNode,
                }],
            }],
        })
        this.unsetCurrentToken(createRangeFromSingleLocation(location))
        return od
    }

    private onQuotedStringBegin(begin: Range, quote: Quote): p.IValue<boolean> {
        if (DEBUG) console.log(`onQuotedStringBegin`)
        this.setCurrentToken([CurrentTokenType.QUOTED_STRING, { quotedStringNode: "", start: begin, startCharacter: quote }], begin)
        return p.value(false)
    }

    private onQuotedStringEnd(end: Range, quote: string | null): p.IValue<boolean> {
        if (DEBUG) console.log(`onQuotedStringEnd`)
        if (this.currentToken[0] !== CurrentTokenType.QUOTED_STRING) {
            throw new TokenizerStackPanicError(`Unexpected unquoted token end`, end)
        }
        const $tok = this.currentToken[1]
        const value = $tok.quotedStringNode
        const range = createRangeFromLocations($tok.start.start, getEndLocationFromRange(end))

        this.unsetCurrentToken(end)
        return this.parser.onData({
            range: range,
            type: [TokenType.SimpleValue, {
                value: value,
                //startCharacter: $tok.startCharacter,
                terminated: quote !== null,
                quote: $tok.startCharacter,
            }],
        })
    }
    private onLineCommentBegin(range: Range): p.IValue<boolean> {
        if (DEBUG) console.log(`onLineCommentBegin`)

        this.setCurrentToken(
            [CurrentTokenType.LINE_COMMENT, {
                commentNode: "",
                start: range,
                indentation: this.getIndentation(),
            }],
            range
        )

        this.indentationState = [IndentationState.lineIsDitry]
        return p.value(false)
    }
    private onLineCommentEnd(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onLineCommentEnd`)

        if (this.currentToken[0] !== CurrentTokenType.LINE_COMMENT) {
            throw new TokenizerStackPanicError(`Unexpected line comment end`, createRangeFromSingleLocation(location))
        }

        const $ = this.currentToken[1]
        const range = createRangeFromLocations($.start.start, location)
        const endOfStart = getEndLocationFromRange($.start)
        const od = this.parser.onData({
            range: range,
            type: [TokenType.Overhead, {
                type: [OverheadTokenType.Comment, {
                    comment: $.commentNode,
                    innerRange: createRangeFromLocations(
                        {
                            position: endOfStart.position,
                            line: endOfStart.line,
                            column: endOfStart.column,
                        },
                        location,
                    ),
                    indentation: $.indentation,
                    type: "line",
                }],
            }],
        })
        this.unsetCurrentToken(createRangeFromSingleLocation(location))
        return od
    }
    private onSnippet(chunk: string, begin: number, end: number): p.IValue<boolean> {
        if (DEBUG) console.log(`onSnippet`)

        switch (this.currentToken[0]) {
            case CurrentTokenType.LINE_COMMENT: {
                const $ = this.currentToken[1]
                $.commentNode += chunk.substring(begin, end)
                break
            }
            case CurrentTokenType.BLOCK_COMMENT: {
                const $ = this.currentToken[1]
                $.commentNode += chunk.substring(begin, end)
                break
            }
            case CurrentTokenType.NONE: {
                throw new Error(`unexpected snippet`)
            }
            case CurrentTokenType.QUOTED_STRING: {
                const $ = this.currentToken[1]
                $.quotedStringNode += chunk.substring(begin, end)
                break
            }
            case CurrentTokenType.UNQUOTED_TOKEN: {
                const $ = this.currentToken[1]
                $.unquotedTokenNode += chunk.substring(begin, end)
                break
            }
            case CurrentTokenType.WHITESPACE: {
                const $ = this.currentToken[1]
                $.whitespaceNode += chunk.substring(begin, end)
                break
            }
            default:
                assertUnreachable(this.currentToken[0])
        }
        return p.value(false)
    }
    private onNewLine(range: Range): p.IValue<boolean> {
        if (DEBUG) console.log(`onNewLine`)

        this.indentationState = [IndentationState.lineIsVirgin]

        return this.parser.onData({
            range: range,
            type: [TokenType.Overhead, {
                type: [OverheadTokenType.NewLine, {
                }],
            }],
        })
    }
}

export function createTokenizer<ReturnType, ErrorType>(
    parser: TokenConsumer<ReturnType, ErrorType>,
): ITokenStreamConsumer<ReturnType, ErrorType> {
    const p = new Tokenizer(parser)
    return p
}