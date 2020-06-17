/* eslint
    camelcase:"off",
    complexity:"off",
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import { ITokenStreamConsumer } from "./ITokenStreamConsumer"
import {
    RootState,
    ObjectState,
    TaggedUnionState,
    StackContextType,
    StackContextType2,
    CurrentToken,
    TokenType,
    IndentationState,
    IndentationData,
    WhitespaceContext,
    ObjectContext,
    TaggedUnionContext,
    RootState2,
} from "./parserStateTypes"
import { Location, Range, printRange, getEndLocationFromRange, createRangeFromSingleLocation, createRangeFromLocations } from "./location"
import { RangeError } from "./errors"
import { ParserEvent, ParserEventType, ParserPreEvent, ParserPreEventType, PunctionationData, SimpleValueData } from "./ParserEvent"
import { TokenDataType, TokenData } from "./TokenData"
import * as Char from "./Characters"

const DEBUG = false

type StackContext = {
    range: Range
    type:
    | [StackContextType2.ARRAY, {
        //
    }]
    | [StackContextType2.OBJECT, ObjectContext]
    | [StackContextType2.TAGGED_UNION, TaggedUnionContext]
}

export type Context<ReturnType, ErrorType> = {
    unwind: () => void
    getDescription: () => string
    type:
    | [StackContextType.ROOT, RootContext<ReturnType, ErrorType>]
    | [StackContextType.NONROOT, StackContext]
}


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

class ParserStackPanicError extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

export type ParserEventConsumer<ReturnType, ErrorType> = p.IStreamConsumer<ParserEvent, Location, ReturnType, ErrorType>

class PreParser<ReturnType, ErrorType> {
    private readonly parser: Parser<ReturnType, ErrorType>
    private currentToken: CurrentToken = [TokenType.NONE]
    private indentationState: IndentationData = [IndentationState.lineIsVirgin]
    constructor(parser: Parser<ReturnType, ErrorType>) {
        this.parser = parser
    }
    public onData(data: TokenData): p.IValue<boolean> {
        //const $ = this.getCurrentContext()

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
                this.indentationState = [IndentationState.lineIsDitry]
                return this.parser.onData({
                    range: $.range,
                    type: [ParserPreEventType.Punctuation, {
                        char: $.char,
                    }],
                })
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
    public onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> {
        return this.parser.onEnd(aborted, location)
    }
    private onBlockCommentBegin(range: Range): p.IValue<boolean> {
        if (DEBUG) console.log(`onBlockCommentBegin`)

        this.setCurrentToken([TokenType.BLOCK_COMMENT, {
            commentNode: "",
            start: range,
            indentation: this.getIndentation(),
        }], range)

        this.indentationState = [IndentationState.lineIsDitry]
        return p.result(false)
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

        if (this.currentToken[0] !== TokenType.BLOCK_COMMENT) {
            throw new ParserStackPanicError(`Unexpected block comment end`, end)
        }
        const $ = this.currentToken[1]
        const endOfStart = getEndLocationFromRange($.start)
        const od = this.parser.onData({
            range: createRangeFromLocations(
                $.start.start,
                getEndLocationFromRange(end),
            ),
            type: [ParserPreEventType.BlockComment, {
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
            }],
        })
        this.unsetCurrentToken(end)
        return od
    }
    private onUnquotedTokenBegin(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onUnquotedTokenBegin`)

        this.indentationState = [IndentationState.lineIsDitry]

        this.setCurrentToken([TokenType.UNQUOTED_TOKEN, { unquotedTokenNode: "", start: location }], createRangeFromSingleLocation(location))
        return p.result(false)
    }
    private onUnquotedTokenEnd(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onUnquotedTokenEnd`)

        if (this.currentToken[0] !== TokenType.UNQUOTED_TOKEN) {
            throw new ParserStackPanicError(`Unexpected unquoted token end`, createRangeFromSingleLocation(location))
        }
        const $ = this.currentToken[1]

        const $tok = this.currentToken[1]
        const value = $tok.unquotedTokenNode
        const range = createRangeFromLocations($.start, location)
        this.unsetCurrentToken(createRangeFromSingleLocation(location))
        return this.parser.onData({
            range: range,
            type: [ParserPreEventType.SimpleValue, {
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
        this.setCurrentToken([TokenType.WHITESPACE, $], createRangeFromSingleLocation(location))
        return p.result(false)
    }
    private onWhitespaceEnd(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onWhitespaceEnd`)

        if (this.currentToken[0] !== TokenType.WHITESPACE) {
            throw new ParserStackPanicError(`Unexpected whitespace end`, createRangeFromSingleLocation(location))
        }
        const $ = this.currentToken[1]
        const range = createRangeFromLocations($.start, location)
        const od = this.parser.onData({
            range: range,
            type: [ParserPreEventType.WhiteSpace, {
                value: $.whitespaceNode,
            }],
        })
        this.unsetCurrentToken(createRangeFromSingleLocation(location))
        return od
    }

    private onQuotedStringBegin(begin: Range, quote: string): p.IValue<boolean> {
        if (DEBUG) console.log(`onQuotedStringBegin`)
        this.setCurrentToken([TokenType.QUOTED_STRING, { quotedStringNode: "", start: begin, startCharacter: quote }], begin)
        return p.result(false)
    }

    private onQuotedStringEnd(end: Range, quote: string | null): p.IValue<boolean> {
        if (DEBUG) console.log(`onQuotedStringEnd`)
        if (this.currentToken[0] !== TokenType.QUOTED_STRING) {
            throw new ParserStackPanicError(`Unexpected unquoted token end`, end)
        }
        const $tok = this.currentToken[1]
        const value = $tok.quotedStringNode
        const range = createRangeFromLocations($tok.start.start, getEndLocationFromRange(end))

        this.unsetCurrentToken(end)
        return this.parser.onData({
            range: range,
            type: [ParserPreEventType.SimpleValue, {
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
    private onLineCommentEnd(location: Location): p.IValue<boolean> {
        if (DEBUG) console.log(`onLineCommentEnd`)

        if (this.currentToken[0] !== TokenType.LINE_COMMENT) {
            throw new ParserStackPanicError(`Unexpected line comment end`, createRangeFromSingleLocation(location))
        }

        const $ = this.currentToken[1]
        const range = createRangeFromLocations($.start.start, location)
        const endOfStart = getEndLocationFromRange($.start)
        const od = this.parser.onData({
            range: range,
            type: [ParserPreEventType.LineComment, {
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
            }],
        })
        this.unsetCurrentToken(createRangeFromSingleLocation(location))
        return od
    }
    private onSnippet(chunk: string, begin: number, end: number): p.IValue<boolean> {
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
    private onNewLine(range: Range): p.IValue<boolean> {
        if (DEBUG) console.log(`onNewLine`)

        this.indentationState = [IndentationState.lineIsVirgin]

        return this.parser.onData({
            range: range,
            type: [ParserPreEventType.NewLine, {
            }],
        })
    }
}

export type AfterContext<ReturnType, ErrorType> = {
    schemaEventsConsumer: ParserEventConsumer<null, null> | null
    instanceEventsConsumer: ParserEventConsumer<ReturnType, ErrorType> | null

    state: RootContext2
}

export type RootContext<ReturnType, ErrorType> = {
    state:
    | [RootState.AFTER, AfterContext<ReturnType, ErrorType>]
    | [RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE]
}

export type RootContext2 =
    | [RootState2.EXPECTING_END, {
        foo: boolean
    }]
    | [RootState2.EXPECTING_VALUE, {
        foundHash: boolean
    }]
    | [RootState2.EXPECTING_SCHEMA]


class Stack {
    public readonly imp = new Array<StackContext>()
    public currentContext: StackContext | null = null

    public pushContext(context: StackContext) {
        //if (DEBUG) console.log(`pushed context ${this.getCurrentContext().getDescription()}>${context.getDescription()}`)
        if (this.currentContext !== null) {
            this.imp.push(this.currentContext)
        }
        this.currentContext = context
    }
    public popContext(range: Range) {
        const popped = this.imp.pop()
        if (popped === undefined) {
            this.currentContext = null
        } else {
            //if (DEBUG) console.log(`popped context ${popped.getDescription()}<${this.getCurrentContext().getDescription()}`)
            this.currentContext = popped

            switch (popped.type[0]) {
                case StackContextType2.ARRAY:
                    break
                case StackContextType2.OBJECT:
                    break
                case StackContextType2.TAGGED_UNION:
                    this.popContext(range)
                    break
                default:
                    assertUnreachable(popped.type[0])
            }
        }
    }
}

class Parser<ReturnType, ErrorType> {
    private readonly rootContext: RootContext<ReturnType, ErrorType> = { state: [RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE] }
    private readonly stck = new Stack()
    private readonly onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>
    private readonly onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>
    private readonly onerror: (message: string, range: Range) => void

    constructor(

        onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
        onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
        onerror: (message: string, range: Range) => void,
    ) {
        this.onSchemaDataStart = onSchemaDataStart
        this.onInstanceDataStart = onInstanceDataStart
        this.onerror = onerror
    }
    private getCurrentContext(): Context<ReturnType, ErrorType> {
        if (this.stck.currentContext === null) {
            return {
                unwind: () => {
                    //
                },
                getDescription: () => {
                    switch (this.rootContext.state[0]) {
                        case RootState.AFTER: {
                            const $ = this.rootContext.state[1]
                            switch ($.state[0]) {
                                case RootState2.EXPECTING_END: return "EXPECTING_END"
                                case RootState2.EXPECTING_VALUE: return "EXPECTING_VALUE"
                                case RootState2.EXPECTING_SCHEMA: return "EXPECTING_SCHEMA"
                                default: return assertUnreachable($.state[0])
                            }
                        }
                        case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: return "EXPECTING_SCHEMA_START_OR_ROOT_VALUE"
                        default: return assertUnreachable(this.rootContext.state[0])
                    }
                },
                type: [StackContextType.ROOT, this.rootContext],
            }
        } else {
            const cc = this.stck.currentContext
            return {
                unwind: () => {
                    switch (cc.type[0]) {
                        case StackContextType2.ARRAY: {
                            this.raiseError("unexpected end of document, still in array", cc.range)

                            break
                        }
                        case StackContextType2.OBJECT: {
                            this.raiseError("unexpected end of document, still in object", cc.range)

                            break
                        }
                        case StackContextType2.TAGGED_UNION: {
                            this.raiseError("unexpected end of document, still in tagged union", cc.range)

                            break
                        }
                        default:
                            assertUnreachable(cc.type[0])
                    }
                },
                getDescription: () => {
                    return ""
                },
                type: [StackContextType.NONROOT, this.stck.currentContext],
            }
        }
    }
    public onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> {

        const sendEnd = (): p.IUnsafeValue<ReturnType, ErrorType> => {
            if (this.rootContext.state[0] !== RootState.AFTER) {
                throw new Error("unexpected missing parser event consumer")
            }
            if (this.rootContext.state[1].instanceEventsConsumer === null) {
                throw new Error("unexpected missing parser event consumer")
            }
            return this.rootContext.state[1].instanceEventsConsumer.onEnd(aborted, location)
        }

        const range = createRangeFromSingleLocation(location)
        if (aborted) {
            return sendEnd()
        } else {
            unwindLoop: while (true) {
                this.getCurrentContext().unwind()

                const popped = this.stck.imp.pop()
                if (popped === undefined) {
                    this.stck.currentContext = null
                    break unwindLoop
                } else {
                    this.stck.currentContext = popped
                }
            }
            switch (this.rootContext.state[0]) {
                case RootState.AFTER: {
                    const $ = this.rootContext.state[1]
                    const forceInstanceData = () => {
                        return this.startInstanceData($, null, location).try(() => {
                            return sendEnd()
                        })
                    }
                    switch ($.state[0]) {
                        case RootState2.EXPECTING_END: {
                            return p.result(false).try(() => {
                                return sendEnd()
                            })
                        }
                        case RootState2.EXPECTING_VALUE: {
                            const $$ = $.state[1]
                            if (!$$.foundHash) {
                                this.raiseError("expected '#' or rootvalue", range)

                            } else {
                                this.raiseError("expected the root value", range)
                            }
                            return forceInstanceData()
                        }
                        case RootState2.EXPECTING_SCHEMA: {
                            this.raiseError("expected the schema", range)
                            return forceInstanceData()
                        }
                        default:
                            return assertUnreachable($.state)
                    }
                }
                case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                    this.raiseError("expected the schema start (!) or root value", range)

                    return this.onInstanceDataStart(null, location).onEnd(false, location)
                default:
                    return assertUnreachable(this.rootContext.state)
            }

        }
    }
    private onSimpleValue(range: Range, data: SimpleValueData): p.IValue<boolean> {

        const cc = this.getCurrentContext()

        const y = (data2: SimpleValueData) => {
            return this.sendEvent({
                range: range,
                type: [ParserEventType.SimpleValue, data2],
            })
        }

        switch (cc.type[0]) {
            case StackContextType.NONROOT: {
                const $3 = cc.type[1]
                switch ($3.type[0]) {
                    case StackContextType2.ARRAY: {

                        return y(data)
                    }
                    case StackContextType2.OBJECT: {
                        const $$ = $3.type[1]

                        switch ($$.state) {
                            case ObjectState.EXPECTING_KEY:
                                $$.state = ObjectState.EXPECTING_OBJECT_VALUE
                                return y(data)

                            case ObjectState.EXPECTING_OBJECT_VALUE:

                                $$.state = ObjectState.EXPECTING_KEY
                                return y(data)

                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    case StackContextType2.TAGGED_UNION: {
                        const $$ = $3.type[1]

                        switch ($$.state) {
                            case TaggedUnionState.EXPECTING_OPTION:
                                $$.state = TaggedUnionState.EXPECTING_VALUE
                                return y(data)
                            case TaggedUnionState.EXPECTING_VALUE: {
                                this.stck.popContext(range)
                                return y(data)
                            }
                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    default:
                        return assertUnreachable($3.type[0])
                }
            }
            case StackContextType.ROOT: {
                const $$ = cc.type[1]

                return this.wrapupRootBeforeValue($$, range).mapResult(() => {


                    this.setRootStateAfterValue($$)
                    return y(data)
                })
            }
            default:
                return assertUnreachable(cc.type[0])
        }

    }
    public onData(data: ParserPreEvent): p.IValue<boolean> {
        switch (data.type[0]) {
            case ParserPreEventType.BlockComment: {
                const $ = data.type[1]

                return this.sendEvent({
                    range: data.range,
                    type: [ParserEventType.BlockComment, $],
                })
            }
            case ParserPreEventType.LineComment: {
                const $ = data.type[1]

                return this.sendEvent({
                    range: data.range,
                    type: [ParserEventType.LineComment, $],
                })
            }
            case ParserPreEventType.NewLine: {
                const $ = data.type[1]

                return this.sendEvent({
                    range: data.range,
                    type: [ParserEventType.NewLine, $],
                })
            }
            case ParserPreEventType.Punctuation: {
                const $ = data.type[1]
                return this.onPunctuation(data.range, $)
            }
            case ParserPreEventType.SimpleValue: {
                const $ = data.type[1]

                return this.onSimpleValue(
                    data.range,
                    $,
                )
            }
            case ParserPreEventType.WhiteSpace: {
                const $ = data.type[1]

                return this.sendEvent({
                    range: data.range,
                    type: [ParserEventType.WhiteSpace, $],
                })
            }
            default:
                return assertUnreachable(data.type[0])
        }
    }
    private onBodyPunctuation(range: Range, data: PunctionationData): p.IValue<boolean> {
        const curChar = data.char
        switch (curChar) {
            case Char.Punctuation.exclamationMark:
                this.raiseError("unexpected !", range)
                return p.result(false)
            case Char.Punctuation.hash:
                this.raiseError("unexpected '#', expected a value after a comma", range)
                return p.result(false)
            case Char.Punctuation.closeAngleBracket:
                return this.onArrayClose(curChar, range)
            case Char.Punctuation.closeBracket:
                return this.onArrayClose(curChar, range)
            case Char.Punctuation.comma:
                //
                return this.sendEvent({
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
                return this.sendEvent({
                    range: range,
                    type: [ParserEventType.Colon, {
                    }],
                })
            case Char.Punctuation.openBrace:
                return this.onObjectOpen(curChar, range)
            case Char.Punctuation.openParen:
                return this.onObjectOpen(curChar, range)
            case Char.Punctuation.verticalLine:
                return this.onTaggedUnion(range)

            default:
                this.raiseError(`unknown punctuation: ${String.fromCharCode(curChar)}`, range)
                return p.result(false)
        }
    }
    private onPunctuation(range: Range, data: PunctionationData): p.IValue<boolean> {

        const $ = this.getCurrentContext()
        switch ($.type[0]) {
            case StackContextType.NONROOT: {
                return this.onBodyPunctuation(range, data)
            }
            case StackContextType.ROOT: {

                const curChar = data.char

                const $$2 = $.type[1]
                switch (curChar) {
                    case Char.Punctuation.exclamationMark:
                        /**
                         * ROOT PROCESSING
                         */
                        switch ($$2.state[0]) {
                            case RootState.AFTER: {
                                const $$4 = $$2.state[1]
                                switch ($$4.state[0]) {
                                    case RootState2.EXPECTING_END: {
                                        this.raiseError(`Unexpected data after end`, range)
                                        break
                                    }
                                    case RootState2.EXPECTING_VALUE: {
                                        const $ = $$4.state[1]
                                        if ($.foundHash) {
                                            this.raiseError("unexpected '!', expected root value", range)
                                        } else {
                                            this.raiseError("unexpected '!', expected '#' or value", range)
                                        }
                                        break
                                    }
                                    case RootState2.EXPECTING_SCHEMA: {
                                        this.raiseError("unexpected '!', expected schema value", range)
                                        break
                                    }
                                    default:
                                        return assertUnreachable($$4.state)
                                }
                                break
                            }
                            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                                $$2.state = [RootState.AFTER, {
                                    schemaEventsConsumer: this.onSchemaDataStart(range),
                                    instanceEventsConsumer: null,
                                    state: [RootState2.EXPECTING_SCHEMA],
                                }]
                                break
                            default:
                                return assertUnreachable($$2.state)
                        }
                        return p.result(false)
                    case Char.Punctuation.hash:
                        /**
                         * ROOT PROCESSING
                         */
                        switch ($$2.state[0]) {
                            case RootState.AFTER: {
                                const $$4 = $$2.state[1]
                                switch ($$4.state[0]) {
                                    case RootState2.EXPECTING_END: {
                                        this.raiseError("unexpected '#', expected no more data", range)
                                        break
                                    }
                                    case RootState2.EXPECTING_SCHEMA: {
                                        this.raiseError("unexpected '#', expected the schema", range)
                                        break
                                    }
                                    case RootState2.EXPECTING_VALUE: {
                                        const $$ = $$4.state[1]
                                        if ($$.foundHash) {
                                            this.raiseError("unexpected '#', expected the root value", range)

                                        }
                                        $$.foundHash = true
                                        break
                                    }
                                    default:
                                        return assertUnreachable($$4.state[0])
                                }
                                return this.startInstanceData($$4, range, getEndLocationFromRange(range))
                            }
                            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                                this.raiseError("unexpected '#', expected an '!' (to specify a schema) or a value", range)
                                this.rootContext.state = [RootState.AFTER, {
                                    schemaEventsConsumer: null,
                                    instanceEventsConsumer: null,
                                    state: [RootState2.EXPECTING_END, {
                                        foo: true,
                                    }],
                                }]
                                return this.startInstanceData(this.rootContext.state[1], range, getEndLocationFromRange(range))
                            default:
                                return assertUnreachable($$2.state)
                        }
                    default:
                        //not a # of a !
                        // switch ($$2.state[0]) {
                        //     case RootState.AFTER: {
                        //         const $$4 = $$2.state[1]
                        //         switch ($$4.state[0]) {
                        //             case RootState2.EXPECTING_END: {
                        //                 break
                        //             }
                        //             case RootState2.EXPECTING_HASH_OR_ROOTVALUE: {
                        //                 break
                        //             }
                        //             case RootState2.EXPECTING_SCHEMA: {
                        //                 break
                        //             }
                        //             case RootState2.EXPECTING_ROOTVALUE_AFTER_HASH: {
                        //                 break
                        //             }
                        //             default:
                        //                 assertUnreachable($$4.state[0])
                        //         }
                        //         break
                        //     }
                        //     case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                        //         break
                        //     default:
                        //         assertUnreachable($$2.state)
                        // }
                        return this.wrapupRootBeforeValue($$2, range).mapResult((): p.IValue<boolean> => {
                            return this.onBodyPunctuation(range, data)
                        })
                }
            }
            default:
                return assertUnreachable($.type[0])
        }
    }
    private onTaggedUnion(range: Range) {

        const taggedUnion = { state: TaggedUnionState.EXPECTING_OPTION }
        return this.onComplexValue(range).mapResult(() => {
            // this.pushContext({
            //     unwind: () => {
            //         this.raiseError("unexpected end of document, still in tagged union", range)
            //     },
            //     getDescription: () => {

            //         switch (taggedUnion.state) {
            //             case TaggedUnionState.EXPECTING_OPTION: return "EXPECTING_OPTION"
            //             case TaggedUnionState.EXPECTING_VALUE: return "EXPECTING_VALUE"
            //             default: return assertUnreachable(taggedUnion.state)
            //         }
            //     },
            //     type: [StackContextType.NONROOT, { type: [StackContextType2.TAGGED_UNION, taggedUnion] }],
            // })
            this.stck.pushContext({ range: range, type: [StackContextType2.TAGGED_UNION, taggedUnion] })
            return this.sendEvent({
                range: range,
                type: [ParserEventType.TaggedUnion, {
                }],
            })

        })
    }
    private sendEvent(data: ParserEvent): p.IValue<boolean> {
        if (this.rootContext.state[0] === RootState.AFTER && this.rootContext.state[1].instanceEventsConsumer !== null) {
            return this.rootContext.state[1].instanceEventsConsumer.onData(data)
        }
        if (this.rootContext.state[0] === RootState.AFTER && this.rootContext.state[1].schemaEventsConsumer !== null) {
            return this.rootContext.state[1].schemaEventsConsumer.onData(data)
        }
        console.error("dropping token, no events consumer")
        //throw new Error("unexpected missing parser event consumer")
        return p.result(false)
    }
    private onObjectOpen(curChar: number, range: Range): p.IValue<boolean> {
        return this.onComplexValue(range).mapResult(() => {
            const obj = {
                state: ObjectState.EXPECTING_KEY, openChar: curChar,
            }
            // this.pushContext({
            //     unwind: () => {
            //         this.raiseError("unexpected end of document, still in object", range)
            //     },
            //     getDescription: () => {

            //         switch (obj.state) {
            //             case ObjectState.EXPECTING_OBJECT_VALUE: return "EXPECTING_OBJECTVALUE"
            //             case ObjectState.EXPECTING_KEY: return "EXPECTING_KEY"
            //             default: return assertUnreachable(obj.state)
            //         }
            //     },
            //     type: [StackContextType.NONROOT, { type: [StackContextType2.OBJECT, obj] }],
            // })
            this.stck.pushContext({ range: range, type: [StackContextType2.OBJECT, obj] })
            return this.sendEvent({
                range: range,
                type: [ParserEventType.OpenObject, {
                    openCharacter: String.fromCharCode(curChar),
                }],
            })

        })
    }
    private onObjectClose(curChar: number, range: Range): p.IValue<boolean> {
        const cc = this.getCurrentContext()
        if (cc.type[0] !== StackContextType.NONROOT || cc.type[1].type[0] !== StackContextType2.OBJECT) {
            this.raiseError("not in an object", range)
            return this.sendEvent({
                range: range,
                type: [ParserEventType.CloseObject, {
                    closeCharacter: String.fromCharCode(curChar),
                }],
            })
        } else {
            if (cc.type[1].type[1].state === ObjectState.EXPECTING_OBJECT_VALUE) {
                this.raiseError("missing property value", range)
            }
            const od = this.sendEvent({
                range: range,
                type: [ParserEventType.CloseObject, {
                    closeCharacter: String.fromCharCode(curChar),
                }],
            })
            this.stck.popContext(range)
            return od
        }
    }
    private onArrayOpen(curChar: number, range: Range) {
        return this.onComplexValue(range).mapResult(() => {
            // this.pushContext({
            //     unwind: () => {
            //         this.raiseError("unexpected end of document, still in array", range)
            //     },
            //     getDescription: () => {
            //         return "EXPECTING_ARRAYVALUE"
            //     },
            //     type: [StackContextType.NONROOT, { type: [StackContextType2.ARRAY, { openChar: curChar }] }],
            // })
            this.stck.pushContext({ range: range, type: [StackContextType2.ARRAY, { openChar: curChar }] })
            return this.sendEvent({
                range: range,
                type: [ParserEventType.OpenArray, {
                    openCharacter: String.fromCharCode(curChar),
                }],
            })

        })
    }
    private onArrayClose(curChar: number, range: Range) {
        const cc = this.getCurrentContext()
        if (cc.type[0] !== StackContextType.NONROOT || cc.type[1].type[0] !== StackContextType2.ARRAY) {
            this.raiseError("not in an array", range)
        } else {
            this.stck.popContext(range)
        }
        return this.sendEvent({
            range: range,
            type: [ParserEventType.CloseArray, {
                closeCharacter: String.fromCharCode(curChar),
            }],
        })
    }
    private onComplexValue(range: Range): p.IValue<boolean> {
        const $ = this.getCurrentContext()
        switch ($.type[0]) {
            case StackContextType.NONROOT: {
                const $3 = $.type[1]
                switch ($3.type[0]) {
                    case StackContextType2.ARRAY: {
                        return p.result(false)
                    }
                    case StackContextType2.OBJECT: {
                        const $$ = $3.type[1]
                        switch ($$.state) {
                            case ObjectState.EXPECTING_KEY:
                                return p.result(false)
                            case ObjectState.EXPECTING_OBJECT_VALUE:
                                $$.state = ObjectState.EXPECTING_KEY
                                return p.result(false)
                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    case StackContextType2.TAGGED_UNION: {
                        const $$ = $3.type[1]
                        switch ($$.state) {
                            case TaggedUnionState.EXPECTING_OPTION:
                                this.raiseError("expected option", range)
                                return p.result(false)
                            case TaggedUnionState.EXPECTING_VALUE: {
                                return p.result(false)
                            }
                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    default:
                        return assertUnreachable($3.type[0])
                }
            }
            case StackContextType.ROOT: {
                const $$ = $.type[1]

                this.setRootStateAfterValue($$)
                return p.result(false)
            }
            default:
                return assertUnreachable($.type[0])
        }

    }
    private startInstanceData(afterContext: AfterContext<ReturnType, ErrorType>, compact: null | Range, location: Location) {
        if (afterContext.schemaEventsConsumer !== null) {

            return afterContext.schemaEventsConsumer.onEnd(false, location).reworkAndCatch(
                () => {

                    afterContext.instanceEventsConsumer = this.onInstanceDataStart(compact, location)
                    return p.result(false)
                },
                () => {

                    afterContext.instanceEventsConsumer = this.onInstanceDataStart(compact, location)
                    return p.result(false)
                },
            )
        } else {
            afterContext.instanceEventsConsumer = this.onInstanceDataStart(compact, location)
            return p.result(false)

        }
    }
    private wrapupRootBeforeValue(root: RootContext<ReturnType, ErrorType>, range: Range): p.IValue<boolean> {

        switch (root.state[0]) {
            case RootState.AFTER: {
                const $$4 = root.state[1]
                switch ($$4.state[0]) {
                    case RootState2.EXPECTING_END: {
                        this.raiseError(`Unexpected data after end`, range)
                        return p.result(false)
                    }
                    case RootState2.EXPECTING_SCHEMA: {
                        return p.result(false)
                    }
                    case RootState2.EXPECTING_VALUE: {
                        const $$ = $$4.state[1]
                        if ($$.foundHash) {
                            return p.result(false)
                        } else {
                            return this.startInstanceData($$4, null, getEndLocationFromRange(range))
                        }
                    }
                    default:
                        return assertUnreachable($$4.state[0])
                }
            }
            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                this.rootContext.state = [RootState.AFTER, {
                    schemaEventsConsumer: null,
                    instanceEventsConsumer: null,
                    state: [RootState2.EXPECTING_END, {
                        foo: true,
                    }],
                }]
                return this.startInstanceData(this.rootContext.state[1], null, getEndLocationFromRange(range))
            default:
                return assertUnreachable(root.state[0])
        }
    }
    private setRootStateAfterValue(rootContext: RootContext<ReturnType, ErrorType>) {
        const $$ = rootContext
        switch ($$.state[0]) {
            case RootState.AFTER: {
                const $$4 = $$.state[1]
                switch ($$4.state[0]) {
                    case RootState2.EXPECTING_END: {
                        break
                    }
                    case RootState2.EXPECTING_VALUE: {
                        if ($$4.instanceEventsConsumer === null) {
                            throw new Error("missing instance events consumer")
                        }
                        $$4.state = [RootState2.EXPECTING_END, {
                            foo: true,
                        }]
                        break
                    }
                    case RootState2.EXPECTING_SCHEMA: {
                        $$4.state = [RootState2.EXPECTING_VALUE, {
                            foundHash: false,
                        }]
                        break
                    }
                    default:
                        assertUnreachable($$4.state[0])
                }
                break
            }
            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                $$.state = [RootState.AFTER, {
                    schemaEventsConsumer: null,
                    instanceEventsConsumer: null,
                    state: [RootState2.EXPECTING_END, {
                        foo: true,
                    }],
                }]
                break
            default:
                assertUnreachable($$.state[0])
        }
    }
    private raiseError(message: string, range: Range) {
        if (DEBUG) { console.log("error raised:", message, printRange(range)) }
        this.onerror(message, range)
    }
}

class StreamParser<ReturnType, ErrorType> implements ITokenStreamConsumer<ReturnType, ErrorType> {
    private readonly parser: PreParser<ReturnType, ErrorType>
    constructor(

        onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
        onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
        onerror: (message: string, range: Range) => void,
    ) {
        this.parser = new PreParser(new Parser(onSchemaDataStart, onInstanceDataStart, onerror))
    }
    public onData(data: TokenData): p.IValue<boolean> {
        return this.parser.onData(data)
    }
    public onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> {
        return this.parser.onEnd(aborted, location)
    }
}

export function createParser<ReturnType, ErrorType>(
    onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
    onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
    onerror: (message: string, range: Range) => void,
): ITokenStreamConsumer<ReturnType, ErrorType> {
    const p = new StreamParser(onSchemaDataStart, onInstanceDataStart, onerror)
    return p
}