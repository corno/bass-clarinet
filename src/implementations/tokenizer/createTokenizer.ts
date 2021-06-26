/* eslint
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import { Location, Range, getEndLocationFromRange, createRangeFromSingleLocation, createRangeFromLocations } from "../../generic/location"
import { RangeError } from "../../generic/errors"
import { IPreTokenStreamConsumer } from "../../interfaces/IPreTokenStreamConsumer"
import { TokenConsumer } from "../../interfaces/ITokenConsumer"
import { PreToken, PreTokenDataType, WrappedStringType } from "../../interfaces/IPreTokenStreamConsumer"
import { TokenType } from "../../interfaces/ITreeParser"
import { TokenizerAnnotationData } from "../../interfaces"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}


type NonWrappedStringContext = {
    nonwrappedStringNode: string
    readonly start: Location
}
type WhitespaceContext = {
    whitespaceNode: string
    readonly start: Location
}

type CommentContext = {
    commentNode: string
    readonly start: Range
    readonly indentation: null | string
}

enum CurrentTokenType {
    LINE_COMMENT,
    BLOCK_COMMENT,
    QUOTED_STRING,
    NONE,
    NONWRAPPED_STRING,
    WHITESPACE,
}


type WrappedStringContext = {
    readonly type: WrappedStringType
    readonly start: Range
    wrappedStringNode: string
    indentation: string

}


type CurrentToken =
    | [CurrentTokenType.NONE]
    | [CurrentTokenType.LINE_COMMENT, CommentContext]
    | [CurrentTokenType.BLOCK_COMMENT, CommentContext]
    | [CurrentTokenType.NONWRAPPED_STRING, NonWrappedStringContext]
    | [CurrentTokenType.QUOTED_STRING, WrappedStringContext]
    | [CurrentTokenType.WHITESPACE, WhitespaceContext]

const DEBUG = false

class TokenizerStackPanicError extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

export function createTokenizer<ReturnType, ErrorType>(
    parser: TokenConsumer<TokenizerAnnotationData, ReturnType, ErrorType>,
): IPreTokenStreamConsumer<ReturnType, ErrorType> {

    class IndentationState {
        private indentation = ""
        private lineIsDirty = false
        setLineDirty() {
            this.lineIsDirty = true
        }
        onWhitespace(value: string) {
            if (!this.lineIsDirty) {
                this.indentation = value
            }
        }
        onNewline() {
            this.indentation = ""
            this.lineIsDirty = false
        }
        getIndentation() {
            return this.indentation
        }
    }

    const indentationState = new IndentationState()

    function createAnnotation(
        range: Range,
        tokenString: string | null,
    ): TokenizerAnnotationData {
        return {
            tokenString: tokenString,
            range: range,
            indentation: indentationState.getIndentation(),
            contextData: {
                before: {
                    comments: [],
                },
                lineCommentAfter: null,
            },

        }
    }
    class Tokenizer {
        private readonly parser: TokenConsumer<TokenizerAnnotationData, ReturnType, ErrorType>
        private currentToken: CurrentToken = [CurrentTokenType.NONE]
        constructor(consumer: TokenConsumer<TokenizerAnnotationData, ReturnType, ErrorType>) {
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
                    indentationState.setLineDirty()
                    return this.parser.onData({
                        annotation: createAnnotation(
                            $.range,
                            String.fromCharCode($.char),
                        ),
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
                    indentationState.setLineDirty()
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
            return this.parser.onEnd(
                aborted,
                createAnnotation(
                    createRangeFromLocations(location, location),
                    null,
                )
            )
        }
        private onBlockCommentBegin(range: Range): p.IValue<boolean> {
            if (DEBUG) console.log(`onBlockCommentBegin`)

            this.setCurrentToken([CurrentTokenType.BLOCK_COMMENT, {
                commentNode: "",
                start: range,
                indentation: indentationState.getIndentation(),
            }], range)

            indentationState.setLineDirty()
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
        private onBlockCommentEnd(end: Range): p.IValue<boolean> {
            if (DEBUG) console.log(`onBlockCommentEnd`)

            if (this.currentToken[0] !== CurrentTokenType.BLOCK_COMMENT) {
                throw new TokenizerStackPanicError(`Unexpected block comment end`, end)
            }
            //const $ = this.currentToken[1]
            //const endOfStart = getEndLocationFromRange($.start)
            // const od = this.parser.onData({
            //     tokenString: "*/",
            //     range: createRangeFromLocations(
            //         $.start.start,
            //         getEndLocationFromRange(end),
            //     ),
            //     type: [TokenType.Overhead, {
            //         type: [OverheadTokenType.Comment, {
            //             comment: $.commentNode,
            //             innerRange: createRangeFromLocations(
            //                 {
            //                     position: endOfStart.position,
            //                     line: endOfStart.line,
            //                     column: endOfStart.column,
            //                 },
            //                 {
            //                     position: end.start.position,
            //                     line: end.start.line,
            //                     column: end.start.column,
            //                 },
            //             ),
            //             indentation: $.indentation,
            //             type: "block",
            //         }],
            //     }],
            // })
            this.unsetCurrentToken(end)
            //return od
            return p.value(false)
        }
        private onNonWrappedStringBegin(location: Location): p.IValue<boolean> {
            if (DEBUG) console.log(`onNonWrappedStringBegin`)

            indentationState.setLineDirty()

            this.setCurrentToken([CurrentTokenType.NONWRAPPED_STRING, { nonwrappedStringNode: "", start: location }], createRangeFromSingleLocation(location))
            return p.value(false)
        }
        private onNonWrappedStringEnd(location: Location): p.IValue<boolean> {
            if (DEBUG) console.log(`onNonWrappedStringEnd`)

            if (this.currentToken[0] !== CurrentTokenType.NONWRAPPED_STRING) {
                throw new TokenizerStackPanicError(`Unexpected nonwrapped string end`, createRangeFromSingleLocation(location))
            }
            const $ = this.currentToken[1]

            const $tok = this.currentToken[1]
            const value = $tok.nonwrappedStringNode
            const range = createRangeFromLocations($.start, location)
            this.unsetCurrentToken(createRangeFromSingleLocation(location))
            return this.parser.onData({
                annotation: createAnnotation(
                    range,
                    ""
                ),
                type: [TokenType.SimpleString, {
                    value: value,
                    wrapping: ["none", {
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

            this.setCurrentToken([CurrentTokenType.WHITESPACE, $], createRangeFromSingleLocation(location))
            return p.value(false)
        }
        private onWhitespaceEnd(location: Location): p.IValue<boolean> {
            if (DEBUG) console.log(`onWhitespaceEnd`)

            if (this.currentToken[0] !== CurrentTokenType.WHITESPACE) {
                throw new TokenizerStackPanicError(`Unexpected whitespace end`, createRangeFromSingleLocation(location))
            }
            const $ = this.currentToken[1]
            //const range = createRangeFromLocations($.start, location)
            indentationState.onWhitespace($.whitespaceNode)
            // const od = this.parser.onData({
            //     tokenString: $.whitespaceNode,
            //     range: range,
            //     type: [TokenType.Overhead, {
            //         type: [OverheadTokenType.WhiteSpace, {
            //             value: $.whitespaceNode,
            //         }],
            //     }],
            // })
            this.unsetCurrentToken(createRangeFromSingleLocation(location))
            //return od
            return p.value(false)
        }

        private onWrappedStringBegin(begin: Range, quote: WrappedStringType): p.IValue<boolean> {
            if (DEBUG) console.log(`onWrappedStringBegin`)
            this.setCurrentToken(
                [CurrentTokenType.QUOTED_STRING, {
                    wrappedStringNode: "",
                    start: begin,
                    type: quote,
                    indentation: indentationState.getIndentation(),
                }],
                begin
            )
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

            switch ($.type[0]) {
                case "apostrophe": {
                    return this.parser.onData({
                        annotation: createAnnotation(
                            range,
                            `'${$.wrappedStringNode}'`,
                        ),
                        type: [TokenType.SimpleString, {
                            value: $.wrappedStringNode,
                            wrapping: ["apostrophe", {
                                terminated: wrapper !== null,
                            }],
                        }],
                    })
                }
                case "multiline": {
                    const $$ = $.type[1]
                    function trimStringLines(lines: string[], indentation: string) {
                        return lines.map((line, index) => {
                            if (index === 0) { //the first line needs no trimming
                                return line
                            }
                            if (line.startsWith(indentation)) {
                                return line.substr(indentation.length)
                            }
                            return line
                        })
                    }
                    return this.parser.onData({
                        annotation: createAnnotation(
                            range,
                            `\`${$.type[1].previousLines.concat([$.wrappedStringNode]).join("\n")}\``,
                        ),
                        type: [TokenType.MultilineString, {
                            lines: trimStringLines($$.previousLines.concat([$.wrappedStringNode]), $.indentation),
                            terminated: wrapper !== null,
                        }],
                    })
                }
                case "quote": {
                    return this.parser.onData({
                        annotation: createAnnotation(
                            range,
                            `'${$.wrappedStringNode}'`,
                        ),
                        type: [TokenType.SimpleString, {
                            value: $.wrappedStringNode,
                            wrapping: ["quote", {
                                terminated: wrapper !== null,
                            }],
                        }],
                    })
                }
                default:
                    return assertUnreachable($.type[0])
            }
        }
        private onLineCommentBegin(range: Range): p.IValue<boolean> {
            if (DEBUG) console.log(`onLineCommentBegin`)

            this.setCurrentToken(
                [CurrentTokenType.LINE_COMMENT, {
                    commentNode: "",
                    start: range,
                    indentation: indentationState.getIndentation(),
                }],
                range
            )
            indentationState.setLineDirty()
            return p.value(false)
        }
        private onLineCommentEnd(location: Location): p.IValue<boolean> {
            if (DEBUG) console.log(`onLineCommentEnd`)

            if (this.currentToken[0] !== CurrentTokenType.LINE_COMMENT) {
                throw new TokenizerStackPanicError(`Unexpected line comment end`, createRangeFromSingleLocation(location))
            }

            //const $ = this.currentToken[1]
            // const range = createRangeFromLocations($.start.start, location)
            // const endOfStart = getEndLocationFromRange($.start)
            // const od = this.parser.onData({
            //     tokenString: "",
            //     range: range,
            //     type: [TokenType.Overhead, {
            //         type: [OverheadTokenType.Comment, {
            //             comment: $.commentNode,
            //             innerRange: createRangeFromLocations(
            //                 {
            //                     position: endOfStart.position,
            //                     line: endOfStart.line,
            //                     column: endOfStart.column,
            //                 },
            //                 location,
            //             ),
            //             indentation: $.indentation,
            //             type: "line",
            //         }],
            //     }],
            // })
            this.unsetCurrentToken(createRangeFromSingleLocation(location))
            return p.value(false)
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
                case CurrentTokenType.NONWRAPPED_STRING: {
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
        private onNewLine(_range: Range, _tokenString: string): p.IValue<boolean> {
            if (DEBUG) console.log(`onNewLine`)

            indentationState.onNewline()


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

                    // return this.parser.onData({
                    //     tokenString: tokenString,
                    //     range: range,
                    //     type: [TokenType.Overhead, {
                    //         type: [OverheadTokenType.NewLine, {
                    //         }],
                    //     }],
                    // })
                    return p.value(false)
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
                case CurrentTokenType.NONWRAPPED_STRING: {
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
    return new Tokenizer(parser)
}