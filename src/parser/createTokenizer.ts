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
} from "./TextParserStateTypes"
import { Location, Range, getEndLocationFromRange, createRangeFromSingleLocation, createRangeFromLocations } from "./location"
import { PreTokenDataType, PreToken, WrappedStringType } from "./PreToken"
import { TokenType, Token, OverheadTokenType, StringType } from "./Token"
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
                return this.onNewLine($.range, "FIXME NEWLINE TOKEN STRING")
            }
            case PreTokenDataType.Punctuation: {
                const $ = data.type[1]
                this.indentationState = [IndentationState.lineIsDitry]
                return this.parser.onData({
                    tokenString: String.fromCharCode($.char),
                    range: $.range,
                    type: [TokenType.Structural, {
                        char: $.char,
                    }],
                })
            }
            case PreTokenDataType.Snippet: {
                const $ = data.type[1]
                return this.onSnippet($.chunk, $.begin, $.end)
            }
            case PreTokenDataType.WrappedStringBegin: {
                const $ = data.type[1]
                return this.onWrappedStringBegin($.range, $.type)
            }
            case PreTokenDataType.WrappedStringEnd: {
                const $ = data.type[1]
                return this.onWrappedStringEnd($.range, $.wrapper)
            }
            case PreTokenDataType.NonWrappedStringBegin: {
                const $ = data.type[1]
                return this.onNonWrappedStringBegin($.location)
            }
            case PreTokenDataType.NonWrappedStringEnd: {
                const $ = data.type[1]
                return this.onNonWrappedStringEnd($.location)
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
            tokenString: "*/",
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
    private onNonWrappedStringBegin(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onNonWrappedStringBegin`)

        this.indentationState = [IndentationState.lineIsDitry]

        this.setCurrentToken([CurrentTokenType.UNQUOTED_TOKEN, { nonwrappedStringNode: "", start: location }], createRangeFromSingleLocation(location))
        return p.value(false)
    }
    private onNonWrappedStringEnd(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onNonWrappedStringEnd`)

        if (this.currentToken[0] !== CurrentTokenType.UNQUOTED_TOKEN) {
            throw new TokenizerStackPanicError(`Unexpected nonwrapped string end`, createRangeFromSingleLocation(location))
        }
        const $ = this.currentToken[1]

        const $tok = this.currentToken[1]
        const value = $tok.nonwrappedStringNode
        const range = createRangeFromLocations($.start, location)
        this.unsetCurrentToken(createRangeFromSingleLocation(location))
        return this.parser.onData({
            tokenString: "",
            range: range,
            type: [TokenType.String, {
                type: ["nonwrapped", {
                    value: value,
                }],
                //startCharacter: $tok.startCharacter,
                //terminated: null,
                //wrapper: null,
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
            tokenString: $.whitespaceNode,
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

    private onWrappedStringBegin(begin: Range, quote: WrappedStringType): p.IValue<boolean> {
        if (DEBUG) console.log(`onWrappedStringBegin`)
        this.setCurrentToken([CurrentTokenType.QUOTED_STRING, { wrappedStringNode: "", start: begin, type: quote }], begin)
        return p.value(false)
    }

    private onWrappedStringEnd(end: Range, wrapper: string | null): p.IValue<boolean> {
        if (DEBUG) console.log(`onWrappedStringEnd`)
        if (this.currentToken[0] !== CurrentTokenType.QUOTED_STRING) {
            throw new TokenizerStackPanicError(`Unexpected nonwrapped string end`, end)
        }
        const $tok = this.currentToken[1]
        const $ = this.currentToken[1]

        const range = createRangeFromLocations($tok.start.start, getEndLocationFromRange(end))

        this.unsetCurrentToken(end)
        return this.parser.onData({
            tokenString: ((): string => {
                switch ($.type[0]) {
                    case "apostrophed": {
                        return `'${$.wrappedStringNode}'`
                    }
                    case "multiline": {
                        return `\`${$.type[1].previousLines.concat([$.wrappedStringNode]).join("\n")}\``
                    }
                    case "quoted": {
                        return `'${$.wrappedStringNode}'`
                    }
                    default:
                        return assertUnreachable($.type[0])
                }
            })(),
            range: range,
            type: [TokenType.String, {
                type: ((): StringType => {
                    switch ($.type[0]) {
                        case "apostrophed": {
                            return ["apostrophed", {
                                value: $.wrappedStringNode,
                                terminated: wrapper !== null,
                            }]
                        }
                        case "multiline": {
                            const $$ = $.type[1]
                            return ["multiline", {
                                lines: $$.previousLines.concat([$.wrappedStringNode]),
                                terminated: wrapper !== null,
                            }]
                        }
                        case "quoted": {
                            return ["quoted", {
                                value: $.wrappedStringNode,
                                terminated: wrapper !== null,
                            }]
                        }
                        default:
                            return assertUnreachable($.type[0])
                    }
                })(),
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
            tokenString: "",
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
                $.wrappedStringNode += chunk.substring(begin, end)
                break
            }
            case CurrentTokenType.UNQUOTED_TOKEN: {
                const $ = this.currentToken[1]
                $.nonwrappedStringNode += chunk.substring(begin, end)
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
    private onNewLine(range: Range, tokenString: string): p.IValue<boolean> {
        if (DEBUG) console.log(`onNewLine`)

        this.indentationState = [IndentationState.lineIsVirgin]


        switch (this.currentToken[0]) {
            case CurrentTokenType.LINE_COMMENT: {
                throw new Error(`unexpected newline`)
            }
            case CurrentTokenType.BLOCK_COMMENT: {
                throw new Error("IMPLEMENT ME: BLOCK COMMENT NEWLINE")
                // $.type[1].previousLines.push($.wrappedStringNode)
                // $.wrappedStringNode = ""
                return p.value(false)
            }
            case CurrentTokenType.NONE: {

                return this.parser.onData({
                    tokenString: tokenString,
                    range: range,
                    type: [TokenType.Overhead, {
                        type: [OverheadTokenType.NewLine, {
                        }],
                    }],
                })
            }
            case CurrentTokenType.QUOTED_STRING: {
                const $ = this.currentToken[1]
                if ($.type[0] !== "multiline") {
                    throw new Error(`unexpected newline`)
                }
                $.type[1].previousLines.push($.wrappedStringNode)
                $.wrappedStringNode = ""
                return p.value(false)
            }
            case CurrentTokenType.UNQUOTED_TOKEN: {
                throw new Error(`unexpected newline`)
            }
            case CurrentTokenType.WHITESPACE: {
                throw new Error(`unexpected newline`)
            }
            default:
                return assertUnreachable(this.currentToken[0])
        }
    }
}

export function createTokenizer<ReturnType, ErrorType>(
    parser: TokenConsumer<ReturnType, ErrorType>,
): ITokenStreamConsumer<ReturnType, ErrorType> {
    const p = new Tokenizer(parser)
    return p
}