/* eslint
    camelcase:"off",
    complexity:"off",
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import * as Char from "./Characters"
import { ITokenStreamConsumer } from "./ITokenStreamConsumer"
import {
    RootState,
    ObjectState,
    TaggedUnionState,
    StackContext,
    StackContextType,
    CurrentToken,
    TokenType,
    RootContext,
    IndentationState,
    IndentationData,
    WhitespaceContext,
} from "./parserStateTypes"
import { Location, Range, printRange } from "./location"
import { RangeError } from "./errors"
import { IParserEventConsumer, ParserEventType, ParserEvent } from "./IParserEventConsumer"
import { TokenDataType, TokenData } from "./TokenData"

const DEBUG = false


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

class ParserStackPanicError extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

function getContextDescription(stackContext: StackContext): string {
    switch (stackContext[0]) {
        case StackContextType.ROOT: {
            switch (stackContext[1].state) {
                case RootState.EXPECTING_END: return "EXPECTING_END"
                case RootState.EXPECTING_ROOTVALUE_AFTER_HEADER: return "EXPECTING_ROOTVALUE_AFTER_HEADER"
                case RootState.EXPECTING_HASH_OR_ROOTVALUE: return "EXPECTING_ROOTVALUE_OR_HASH"
                case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: return "EXPECTING_SCHEMA_START_OR_ROOT_VALUE"
                case RootState.EXPECTING_SCHEMA: return "EXPECTING_SCHEMA"
                default: return assertUnreachable(stackContext[1].state)
            }
        }
        case StackContextType.OBJECT: {
            switch (stackContext[1].state) {
                case ObjectState.EXPECTING_OBJECT_VALUE: return "EXPECTING_OBJECTVALUE"
                case ObjectState.EXPECTING_KEY: return "EXPECTING_KEY"
                default: return assertUnreachable(stackContext[1].state)
            }
        }
        case StackContextType.ARRAY: return "EXPECTING_ARRAYVALUE"
        case StackContextType.TAGGED_UNION: {
            switch (stackContext[1].state) {
                case TaggedUnionState.EXPECTING_OPTION: return "EXPECTING_OPTION"
                case TaggedUnionState.EXPECTING_VALUE: return "EXPECTING_VALUE"
                default: return assertUnreachable(stackContext[1].state)
            }
        }
        default:
            return assertUnreachable(stackContext[0])
    }
}

export interface HeaderConsumer {
    onHeaderStart(range: Range): IParserEventConsumer
    onCompact(range: Range): void
    onHeaderEnd(range: Range): IParserEventConsumer
}

class Parser implements ITokenStreamConsumer {
    public readonly stack = new Array<StackContext>()
    public readonly headerConsumer: HeaderConsumer
    private currentContext: StackContext
    private parserEventsConsumer?: IParserEventConsumer
    private currentToken: CurrentToken = [TokenType.NONE]
    private readonly onerror: (message: string, range: Range) => void
    private indentationState: IndentationData = [IndentationState.lineIsVirgin]

    constructor(
        headerSubscriber: HeaderConsumer,
        onerror: (message: string, range: Range) => void,
    ) {
        this.headerConsumer = headerSubscriber
        this.onerror = onerror
        this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE }]
    }
    public onData(data: TokenData): p.DataOrPromise<boolean> {
        switch (data.type[0]) {
            case TokenDataType.BlockCommentBegin: {
                const $ = data.type[1]
                return this.onBlockCommentBegin($.range)
            }
            case TokenDataType.BlockCommentEnd: {
                const $ = data.type[1]
                return this.onBlockCommentEnd($.range)
            }
            case TokenDataType.LineCommentBegin: {
                const $ = data.type[1]
                return this.onLineCommentBegin($.range)
            }
            case TokenDataType.LineCommentEnd: {
                const $ = data.type[1]
                return this.onLineCommentEnd($.location)
            }
            case TokenDataType.NewLine: {
                const $ = data.type[1]
                return this.onNewLine($.range)
            }
            case TokenDataType.Punctuation: {
                const $ = data.type[1]
                return this.onPunctuation($.char, $.range)
            }
            case TokenDataType.Snippet: {
                const $ = data.type[1]
                return this.onSnippet($.chunk, $.begin, $.end)
            }
            case TokenDataType.QuotedStringBegin: {
                const $ = data.type[1]
                return this.onQuotedStringBegin($.range, $.quote)
            }
            case TokenDataType.QuotedStringEnd: {
                const $ = data.type[1]
                return this.onQuotedStringEnd($.range, $.quote)
            }
            case TokenDataType.UnquotedTokenBegin: {
                const $ = data.type[1]
                return this.onUnquotedTokenBegin($.location)
            }
            case TokenDataType.UnquotedTokenEnd: {
                const $ = data.type[1]
                return this.onUnquotedTokenEnd($.location)
            }
            case TokenDataType.WhiteSpaceBegin: {
                const $ = data.type[1]
                return this.onWhitespaceBegin($.location)
            }
            case TokenDataType.WhiteSpaceEnd: {
                const $ = data.type[1]
                return this.onWhitespaceEnd($.location)
            }
            default:
                return assertUnreachable(data.type[0])
        }
    }
    public onEnd(aborted: boolean, location: Location): void {

        const range = { start: location, end: location }
        unwindLoop: while (true) {
            switch (this.currentContext[0]) {
                case StackContextType.ARRAY: {
                    this.raiseError("unexpected end of document, still in array", range)
                    break
                }
                case StackContextType.OBJECT: {
                    this.raiseError("unexpected end of document, still in object", range)
                    break
                }
                case StackContextType.ROOT: {
                    break unwindLoop
                    break
                }
                case StackContextType.TAGGED_UNION: {
                    this.raiseError("unexpected end of document, still in tagged union", range)
                    break
                }
                default:
                    assertUnreachable(this.currentContext[0])
            }
            const popped = this.stack.pop()
            if (popped === undefined) {
                throw new ParserStackPanicError("unexpected end of stack", range)
            } else {
                this.currentContext = popped
                // switch (popped[0]) {
                //     case StackContextType.ARRAY: {
                //         //const $ = popped[1]
                //         this.oncurrentdata.signal(s => s.onCloseArray({
                //             range: range,
                //             closeCharacter: undefined,
                //             pauser: undefined,
                //         }))
                //         break
                //     }
                //     case StackContextType.OBJECT: {
                //         //const $ = popped[1]
                //         this.oncurrentdata.signal(s => s.onCloseObject({
                //             range: range,
                //             closeCharacter: undefined,
                //             pauser: undefined,
                //         }))
                //         break
                //     }
                //     case StackContextType.ROOT: {
                //         //const $ = popped[1]

                //         break
                //     }
                //     case StackContextType.TAGGED_UNION: {
                //         //const $ = popped[1]

                //         break
                //     }
                //     default:
                //         return assertUnreachable(popped[0])
                // }
            }
        }
        const $$ = this.currentContext[1]
        switch ($$.state) {
            case RootState.EXPECTING_END: {
                break
            }
            case RootState.EXPECTING_HASH_OR_ROOTVALUE: {
                this.raiseError("expected hash or rootvalue", range)
                this.onHeaderEnd(range)
                break
            }
            case RootState.EXPECTING_SCHEMA: {
                this.raiseError("expected the schema", range)
                this.onHeaderEnd(range)
                break
            }
            case RootState.EXPECTING_ROOTVALUE_AFTER_HEADER: {
                this.raiseError("expected the root value", range)
                break
            }
            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                this.raiseError("expected the schema start (!) or root value", range)
                this.onHeaderEnd(range)
                break
            default:
                assertUnreachable($$.state)
        }
        if (this.parserEventsConsumer === undefined) {
            throw new Error("unexpected missing parser event consumer")
        }
        this.parserEventsConsumer.onEnd(aborted, location)
    }
    public onPunctuation(curChar: number, range: Range): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onPunctuation`, curChar, String.fromCharCode(curChar))
        const $ = this.currentContext
        this.indentationState = [IndentationState.lineIsDitry]


        switch (curChar) {
            case Char.Punctuation.exclamationMark:
                switch ($[0]) {
                    case StackContextType.ARRAY: {
                        this.raiseError("unexpected !", range)
                        break
                    }
                    case StackContextType.OBJECT: {
                        this.raiseError("unexpected !", range)
                        break
                    }
                    case StackContextType.ROOT: {
                        /**
                         * ROOT PROCESSING
                         */
                        const $$ = $[1]
                        switch ($$.state) {
                            case RootState.EXPECTING_END: {
                                this.raiseError(`Unexpected data after end`, range)
                                break
                            }
                            case RootState.EXPECTING_HASH_OR_ROOTVALUE: {
                                this.raiseError("unexpected '!', expected '#' or value", range)
                                break
                            }
                            case RootState.EXPECTING_SCHEMA: {
                                this.raiseError("unexpected '!', expected schema value", range)
                                break
                            }
                            case RootState.EXPECTING_ROOTVALUE_AFTER_HEADER: {
                                this.raiseError("unexpected '!', expected root value", range)
                                break
                            }
                            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                                $$.state = RootState.EXPECTING_SCHEMA
                                break
                            default:
                                return assertUnreachable($$.state)
                        }
                        break
                    }
                    case StackContextType.TAGGED_UNION: {
                        this.raiseError("unexpected !", range)
                        break
                    }
                    default:
                        return assertUnreachable($[0])
                }
                this.parserEventsConsumer = this.headerConsumer.onHeaderStart(range)
                return p.result(false)
            case Char.Punctuation.hash:
                switch ($[0]) {
                    case StackContextType.ARRAY: {
                        this.raiseError("unexpected '#', expected a value after a comma", range)
                        break
                    }
                    case StackContextType.OBJECT: {
                        this.raiseError("unexpected '#'", range)
                        break
                    }
                    case StackContextType.ROOT: {
                        /**
                         * ROOT PROCESSING
                         */
                        const $$ = $[1]
                        switch ($$.state) {
                            case RootState.EXPECTING_END: {
                                this.raiseError("unexpected '#', expected no more data", range)
                                break
                            }
                            case RootState.EXPECTING_HASH_OR_ROOTVALUE: {
                                $$.state = RootState.EXPECTING_ROOTVALUE_AFTER_HEADER
                                break
                            }
                            case RootState.EXPECTING_SCHEMA: {
                                this.raiseError("unexpected '#', expected the schema", range)
                                break
                            }
                            case RootState.EXPECTING_ROOTVALUE_AFTER_HEADER: {
                                this.raiseError("unexpected '#', expected the root value", range)
                                break
                            }
                            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                                this.raiseError("unexpected '#', expected an '!' (to specify a schema) or a value", range)
                                break
                            default:
                                return assertUnreachable($$.state)
                        }
                        break
                    }
                    case StackContextType.TAGGED_UNION: {
                        this.raiseError("unexpected '#'", range)
                        break
                    }
                    default:
                        return assertUnreachable($[0])
                }
                this.headerConsumer.onCompact(range)
                this.onHeaderEnd(range)
                return p.result(false)
            case Char.Punctuation.closeAngleBracket:
                return this.onArrayClose(curChar, range)
            case Char.Punctuation.closeBracket:
                return this.onArrayClose(curChar, range)
            case Char.Punctuation.comma:
                //
                return this.tempOnData({
                    range: range,
                    type: [ParserEventType.Comma, {
                    }],
                })
            case Char.Punctuation.openAngleBracket:
                return this.onArrayOpen(curChar, range)
            case Char.Punctuation.openBracket:
                return this.onArrayOpen(curChar, range)
            case Char.Punctuation.closeBrace:
                return this.onObjectClose(curChar, range)
            case Char.Punctuation.closeParen:
                return this.onObjectClose(curChar, range)
            case Char.Punctuation.colon:
                //
                return this.tempOnData({
                    range: range,
                    type: [ParserEventType.Colon, {
                    }],
                })
            case Char.Punctuation.openBrace:
                return this.onObjectOpen(curChar, range)
            case Char.Punctuation.openParen:
                return this.onObjectOpen(curChar, range)
            case Char.Punctuation.verticalLine:
                this.onNonStringValue(range)
                this.pushContext([StackContextType.TAGGED_UNION, { state: TaggedUnionState.EXPECTING_OPTION }])
                return this.tempOnData({
                    range: range,
                    type: [ParserEventType.TaggedUnion, {
                    }],
                })
            default:
                this.raiseError(`unknown punctuation: ${String.fromCharCode(curChar)}`, range)
                return p.result(false)
        }
    }
    public onSnippet(chunk: string, begin: number, end: number): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onSnippet`)

        switch (this.currentToken[0]) {
            case TokenType.LINE_COMMENT: {
                const $ = this.currentToken[1]
                $.commentNode += chunk.substring(begin, end)
                break
            }
            case TokenType.BLOCK_COMMENT: {
                const $ = this.currentToken[1]
                $.commentNode += chunk.substring(begin, end)
                break
            }
            case TokenType.NONE: {
                throw new Error(`unexpected snippet`)
            }
            case TokenType.QUOTED_STRING: {
                const $ = this.currentToken[1]
                $.quotedStringNode += chunk.substring(begin, end)
                break
            }
            case TokenType.UNQUOTED_TOKEN: {
                const $ = this.currentToken[1]
                $.unquotedTokenNode += chunk.substring(begin, end)
                break
            }
            case TokenType.WHITESPACE: {
                const $ = this.currentToken[1]
                $.whitespaceNode += chunk.substring(begin, end)
                break
            }
            default:
                assertUnreachable(this.currentToken[0])
        }
        return p.result(false)
    }
    public onNewLine(range: Range): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onNewLine`)

        this.indentationState = [IndentationState.lineIsVirgin]

        return this.tempOnData({
            range: range,
            type: [ParserEventType.NewLine, {
            }],
        })
    }
    public onLineCommentBegin(range: Range): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onLineCommentBegin`)

        this.setCurrentToken(
            [TokenType.LINE_COMMENT, {
                commentNode: "",
                start: range,
                indentation: this.getIndentation(),
            }],
            range
        )

        this.indentationState = [IndentationState.lineIsDitry]
        return p.result(false)
    }
    public onLineCommentEnd(location: Location): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onLineCommentEnd`)

        if (this.currentToken[0] !== TokenType.LINE_COMMENT) {
            throw new ParserStackPanicError(`Unexpected line comment end`, { start: location, end: location })
        }

        const $ = this.currentToken[1]
        const od = this.tempOnData({
            range: {
                start: $.start.start,
                end: location,
            },
            type: [ParserEventType.LineComment, {
                comment: $.commentNode,
                innerRange: {
                    start: {
                        position: $.start.end.position,
                        line: $.start.end.line,
                        column: $.start.end.column,
                    },
                    end: location,
                },
                indentation: $.indentation,
            }],
        })
        this.unsetCurrentToken({ start: location, end: location })
        return od
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
    public onBlockCommentBegin(range: Range): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onBlockCommentBegin`)

        this.setCurrentToken([TokenType.BLOCK_COMMENT, {
            commentNode: "",
            start: range,
            indentation: this.getIndentation(),
        }], range)

        this.indentationState = [IndentationState.lineIsDitry]
        return p.result(false)
    }
    private tempOnData(data: ParserEvent): p.DataOrPromise<boolean> {
        if (this.parserEventsConsumer === undefined) {
            console.error("dropping token, no events consumer")
            //throw new Error("unexpected missing parser event consumer")
            return p.result(false)
        } else {
            return this.parserEventsConsumer.onData(data)
        }
    }
    public onBlockCommentEnd(end: Range): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onBlockCommentEnd`)

        if (this.currentToken[0] !== TokenType.BLOCK_COMMENT) {
            throw new ParserStackPanicError(`Unexpected block comment end`, end)
        }
        const $ = this.currentToken[1]
        const od = this.tempOnData({
            range: {
                start: $.start.start,
                end: end.end,
            },
            type: [ParserEventType.BlockComment, {
                comment: $.commentNode,
                innerRange: {
                    start: {
                        position: $.start.end.position,
                        line: $.start.end.line,
                        column: $.start.end.column,
                    },
                    end: {
                        position: end.start.position,
                        line: end.start.line,
                        column: end.start.column,
                    },
                },
                indentation: $.indentation,
            }],
        })
        this.unsetCurrentToken(end)
        return od
    }
    public onUnquotedTokenBegin(location: Location): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onUnquotedTokenBegin`)

        this.indentationState = [IndentationState.lineIsDitry]

        this.setCurrentToken([TokenType.UNQUOTED_TOKEN, { unquotedTokenNode: "", start: location }], { start: location, end: location })
        return p.result(false)
    }
    public onUnquotedTokenEnd(location: Location): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onUnquotedTokenEnd`)

        if (this.currentToken[0] !== TokenType.UNQUOTED_TOKEN) {
            throw new ParserStackPanicError(`Unexpected unquoted token end`, { start: location, end: location })
        }
        const $ = this.currentToken[1]
        const range = {
            start: $.start,
            end: location,
        }
        this.onNonStringValue(range)
        const od = this.tempOnData({
            range: range,
            type: [ParserEventType.SimpleValue,
            {
                value: $.unquotedTokenNode,
                quote: null,
                terminated: null,
            }],
        })
        this.wrapupAfterValue(range)
        this.unsetCurrentToken({ start: location, end: location })
        return od
    }

    public onWhitespaceBegin(location: Location): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onWhitespaceBegin`)
        const $: WhitespaceContext = { whitespaceNode: "", start: location }

        if (this.indentationState[0] === IndentationState.lineIsVirgin) {

            this.indentationState = [IndentationState.foundIndentation, $]
        }
        this.setCurrentToken([TokenType.WHITESPACE, $], { start: location, end: location })
        return p.result(false)
    }
    public onWhitespaceEnd(location: Location): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onWhitespaceEnd`)

        if (this.currentToken[0] !== TokenType.WHITESPACE) {
            throw new ParserStackPanicError(`Unexpected whitespace end`, { start: location, end: location })
        }
        const $ = this.currentToken[1]
        const range = {
            start: $.start,
            end: location,
        }
        const od = this.tempOnData({
            range: range,
            type: [ParserEventType.WhiteSpace, {
                value: $.whitespaceNode,
            }],
        })
        this.unsetCurrentToken({ start: location, end: location })
        return od
    }

    public onQuotedStringBegin(begin: Range, quote: string): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onQuotedStringBegin`)
        this.setCurrentToken([TokenType.QUOTED_STRING, { quotedStringNode: "", start: begin, startCharacter: quote }], begin)
        return p.result(false)
    }

    public onQuotedStringEnd(end: Range, quote: string | null): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`onQuotedStringEnd`)
        if (this.currentToken[0] !== TokenType.QUOTED_STRING) {
            throw new ParserStackPanicError(`Unexpected unquoted token end`, end)
        }
        const $tok = this.currentToken[1]
        const value = $tok.quotedStringNode
        const range = {
            start: $tok.start.start,
            end: end.end,
        }
        this.wrapupBeforeValue(range)
        const $ = this.currentContext
        const onStringValue = (): p.DataOrPromise<boolean> => {
            const od = this.tempOnData({
                range: range,
                type: [ParserEventType.SimpleValue,
                {
                    value: value,
                    //startCharacter: $tok.startCharacter,
                    terminated: quote !== null,
                    quote: $tok.startCharacter,
                }],
            })
            this.wrapupAfterValue(range)
            return od
        }
        this.unsetCurrentToken(end)

        switch ($[0]) {
            case StackContextType.ARRAY: {
                return onStringValue()
            }
            case StackContextType.OBJECT: {
                const $$ = $[1]
                switch ($$.state) {
                    case ObjectState.EXPECTING_KEY:
                        const od = this.tempOnData({
                            range: range,
                            type: [ParserEventType.SimpleValue,
                            {
                                value: value,
                                quote: $tok.startCharacter,
                                terminated: quote !== null,
                            }],
                        })
                        $$.state = ObjectState.EXPECTING_OBJECT_VALUE
                        return od
                    case ObjectState.EXPECTING_OBJECT_VALUE:
                        const osv = onStringValue()
                        $$.state = ObjectState.EXPECTING_KEY
                        return osv
                    default:
                        return assertUnreachable($$.state)
                }
            }
            case StackContextType.ROOT: {
                const osv = onStringValue()
                this.setRootStateAfterValue($[1])
                return osv
            }
            case StackContextType.TAGGED_UNION: {
                const $$ = $[1]
                switch ($$.state) {
                    case TaggedUnionState.EXPECTING_OPTION:
                        const od = this.tempOnData({
                            range: range,
                            type: [ParserEventType.SimpleValue,
                            {
                                value: value,
                                quote: $tok.startCharacter,
                                terminated: quote !== null,
                            }],
                        })
                        $$.state = TaggedUnionState.EXPECTING_VALUE
                        return od
                    case TaggedUnionState.EXPECTING_VALUE: {
                        return onStringValue()
                    }
                    default:
                        return assertUnreachable($$.state)
                }
            }
            default:
                return assertUnreachable($[0])
        }
    }
    private onObjectOpen(curChar: number, range: Range): p.DataOrPromise<boolean> {
        this.onNonStringValue(range)
        this.pushContext([StackContextType.OBJECT, { state: ObjectState.EXPECTING_KEY, openChar: curChar }])
        return this.tempOnData({
            range: range,
            type: [ParserEventType.OpenObject, {
                openCharacter: String.fromCharCode(curChar),
            }],
        })
    }
    private onObjectClose(curChar: number, range: Range): p.DataOrPromise<boolean> {
        if (this.currentContext[0] !== StackContextType.OBJECT) {
            this.raiseError("not in an object", range)
            return this.tempOnData({
                range: range,
                type: [ParserEventType.CloseObject, {
                    closeCharacter: String.fromCharCode(curChar),
                }],
            })
        } else {
            if (this.currentContext[1].state === ObjectState.EXPECTING_OBJECT_VALUE) {
                this.raiseError("missing property value", range)
            }
            const od = this.tempOnData({
                range: range,
                type: [ParserEventType.CloseObject, {
                    closeCharacter: String.fromCharCode(curChar),
                }],
            })
            this.popContext(range)
            return od
        }
    }
    private onArrayOpen(curChar: number, range: Range) {
        this.onNonStringValue(range)
        this.pushContext([StackContextType.ARRAY, { openChar: curChar }])
        return this.tempOnData({
            range: range,
            type: [ParserEventType.OpenArray, {
                openCharacter: String.fromCharCode(curChar),
            }],
        })
    }
    private onArrayClose(curChar: number, range: Range) {
        const $ = this.currentContext
        if ($[0] !== StackContextType.ARRAY) {
            this.raiseError("not in an array", range)
        } else {
            this.popContext(range)
        }
        return this.tempOnData({
            range: range,
            type: [ParserEventType.CloseArray, {
                closeCharacter: String.fromCharCode(curChar),
            }],
        })
    }
    private onNonStringValue(range: Range) {
        this.wrapupBeforeValue(range)
        const $ = this.currentContext
        switch ($[0]) {
            case StackContextType.ARRAY: {
                break
            }
            case StackContextType.OBJECT: {
                const $$ = $[1]
                switch ($$.state) {
                    case ObjectState.EXPECTING_KEY:
                        //this.raiseError("expected key", range)
                        break
                    case ObjectState.EXPECTING_OBJECT_VALUE:
                        $$.state = ObjectState.EXPECTING_KEY
                        break
                    default:
                        assertUnreachable($$.state)
                }
                break
            }
            case StackContextType.ROOT: {
                this.setRootStateAfterValue($[1])
                break
            }
            case StackContextType.TAGGED_UNION: {
                const $$ = $[1]
                switch ($$.state) {
                    case TaggedUnionState.EXPECTING_OPTION:
                        this.raiseError("expected option", range)
                        break
                    case TaggedUnionState.EXPECTING_VALUE: {
                        break
                    }
                    default:
                        assertUnreachable($$.state)
                }
                break
            }
            default:
                assertUnreachable($[0])
        }
    }

    private setCurrentToken(contextType: CurrentToken, range: Range) {
        if (this.currentToken[0] !== TokenType.NONE) {
            throw new ParserStackPanicError(`unexpected start of token`, range)
        }
        this.currentToken = contextType
    }
    private unsetCurrentToken(range: Range) {
        if (this.currentToken[0] === TokenType.NONE) {
            throw new ParserStackPanicError(`unexpected, parser is already in 'none' mode`, range)
        }
        this.currentToken = [TokenType.NONE]
    }
    private onHeaderEnd(range: Range) {
        this.parserEventsConsumer = this.headerConsumer.onHeaderEnd(range)
    }
    private wrapupBeforeValue(range: Range) {
        const $ = this.currentContext
        switch ($[0]) {
            case StackContextType.ARRAY: {
                break
            }
            case StackContextType.OBJECT: {
                break
            }
            case StackContextType.ROOT: {
                const $$ = $[1]
                switch ($$.state) {
                    case RootState.EXPECTING_END: {
                        this.raiseError(`Unexpected data after end`, range)
                        break
                    }
                    case RootState.EXPECTING_HASH_OR_ROOTVALUE: {
                        this.onHeaderEnd(range)
                        break
                    }
                    case RootState.EXPECTING_SCHEMA: {
                        break
                    }
                    case RootState.EXPECTING_ROOTVALUE_AFTER_HEADER: {
                        break
                    }
                    case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                        this.onHeaderEnd(range)
                        break
                    default:
                        assertUnreachable($$.state)
                }
                break
            }
            case StackContextType.TAGGED_UNION: {
                break
            }
            default:
                assertUnreachable($[0])
        }
    }
    private setRootStateAfterValue(rootContext: RootContext) {
        const $$ = rootContext
        switch ($$.state) {
            case RootState.EXPECTING_END: {
                break
            }
            case RootState.EXPECTING_HASH_OR_ROOTVALUE: {
                $$.state = RootState.EXPECTING_END
                break
            }
            case RootState.EXPECTING_SCHEMA: {
                $$.state = RootState.EXPECTING_HASH_OR_ROOTVALUE
                break
            }
            case RootState.EXPECTING_ROOTVALUE_AFTER_HEADER: {
                $$.state = RootState.EXPECTING_END
                break
            }
            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                $$.state = RootState.EXPECTING_END
                break
            default:
                assertUnreachable($$.state)
        }
    }
    private wrapupAfterValue(range: Range) {
        const currentContext = this.currentContext
        switch (currentContext[0]) {
            case StackContextType.ARRAY:
                break
            case StackContextType.OBJECT:
                break
            case StackContextType.ROOT:
                break
            case StackContextType.TAGGED_UNION:
                this.popContext(range)
                break
            default:
                assertUnreachable(currentContext[0])
        }
    }
    private raiseError(message: string, range: Range) {
        if (DEBUG) { console.log("error raised:", message, printRange(range)) }
        this.onerror(message, range)
    }
    private pushContext(context: StackContext) {
        if (DEBUG) console.log(`pushed context ${getContextDescription(this.currentContext)}>${getContextDescription(context)}`)
        this.stack.push(this.currentContext)
        this.currentContext = context
    }
    private popContext(range: Range) {
        const popped = this.stack.pop()
        if (popped === undefined) {
            throw new ParserStackPanicError("unexpected end of stack", range)
        } else {
            if (DEBUG) console.log(`popped context ${getContextDescription(popped)}<${getContextDescription(this.currentContext)}`)
            this.currentContext = popped
            this.wrapupAfterValue(range)
        }
    }
}

export function createParser(
    onerror: (message: string, range: Range) => void,
    headerSubscriber: HeaderConsumer,
): ITokenStreamConsumer {
    const p = new Parser(headerSubscriber, onerror)
    return p
}