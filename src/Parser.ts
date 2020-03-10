/* eslint
    @typescript-eslint/camelcase: "off",
    camelcase:"off",
    complexity:"off",
    no-console:"off",
    max-classes-per-file:"off",
*/

import * as subscr from "./subscription"
import * as Char from "./Characters"
import { IParser, Pauser } from "./parserAPI"
import {
    RootState,
    ObjectState,
    TaggedUnionState,
    StackContext,
    StackContextType,
    CurrentToken,
    TokenType,
    RootContext,
} from "./parserStateTypes"
import { Location, Range, printRange } from "./location"
import { RangeError } from "./errors"
import { IDataSubscriber } from "./IDataSubscriber"

const DEBUG = false


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

class ParserStackPanicError extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

function getContextDescription(stackContext: StackContext) {
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

export type DataSubscription = subscr.Subscribers<IDataSubscriber>

export interface HeaderSubscriber {
    onHeaderStart(range: Range): void
    onCompact(range: Range): void
    onHeaderEnd(range: Range): void
}

export class Parser implements IParser {
    public readonly stack = new Array<StackContext>()
    public readonly onschemadata = new subscr.Subscribers<IDataSubscriber>()
    public readonly ondata = new subscr.Subscribers<IDataSubscriber>()
    public readonly onheaderdata = new subscr.Subscribers<HeaderSubscriber>()
    private currentContext: StackContext
    private oncurrentdata: subscr.Subscribers<IDataSubscriber>
    private currentToken: CurrentToken = [TokenType.NONE]
    private readonly onerror: (message: string, range: Range) => void

    constructor(onerror: (message: string, range: Range) => void) {
        this.onerror = onerror
        this.oncurrentdata = this.ondata
        this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE }]
    }
    public onEnd(location: Location) {
        const range = { start: location, end: location }
        while (this.currentContext[0] !== StackContextType.ROOT) {
            this.raiseError("unexpected end of document, still in nested type", range)
            const popped = this.stack.pop()
            if (popped === undefined) {
                throw new ParserStackPanicError("unexpected end of stack", range)
            } else {
                this.currentContext = popped
                switch (popped[0]) {
                    case StackContextType.ARRAY: {
                        //const $ = popped[1]
                        this.oncurrentdata.signal(s => s.onCloseArray({
                            range: range,
                            closeCharacter: undefined,
                            pauser: undefined,
                        }))
                        break
                    }
                    case StackContextType.OBJECT: {
                        //const $ = popped[1]
                        this.oncurrentdata.signal(s => s.onCloseObject({
                            range: range,
                            closeCharacter: undefined,
                            pauser: undefined,
                        }))
                        break
                    }
                    case StackContextType.ROOT: {
                        //const $ = popped[1]

                        break
                    }
                    case StackContextType.TAGGED_UNION: {
                        //const $ = popped[1]

                        break
                    }
                    default:
                        return assertUnreachable(popped[0])
                }
            }
        }
        if (this.currentContext[0] === StackContextType.ROOT) {
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
                    return assertUnreachable($$.state)
            }
        } else {
            this.raiseError("unexpected end of document, in nested type", range)
        }
        this.oncurrentdata.signal(s => s.onEnd(location))
    }
    public onPunctuation(curChar: number, range: Range, pauser: Pauser) {
        if (DEBUG) console.log(`onPunctuation`, curChar, String.fromCharCode(curChar))
        const $ = this.currentContext

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
                                this.oncurrentdata = this.onschemadata
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
                this.onheaderdata.signal(s => s.onHeaderStart(range))
                break
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
                                this.oncurrentdata = this.ondata
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
                this.onheaderdata.signal(s => s.onCompact(range))
                this.onHeaderEnd(range)
                break
            case Char.Punctuation.closeAngleBracket:
                this.onArrayClose(curChar, range, pauser)
                break
            case Char.Punctuation.closeBracket:
                this.onArrayClose(curChar, range, pauser)
                break
            case Char.Punctuation.comma:
                //
                this.oncurrentdata.signal(s => s.onComma(range, pauser))
                break
            case Char.Punctuation.openAngleBracket:
                this.onArrayOpen(curChar, range, pauser)
                break
            case Char.Punctuation.openBracket:
                this.onArrayOpen(curChar, range, pauser)
                break
            case Char.Punctuation.closeBrace:
                this.onObjectClose(curChar, range, pauser)
                break
            case Char.Punctuation.closeParen:
                this.onObjectClose(curChar, range, pauser)
                break
            case Char.Punctuation.colon:
                //
                this.oncurrentdata.signal(s => s.onColon(range, pauser))
                break
            case Char.Punctuation.openBrace:
                this.onObjectOpen(curChar, range, pauser)
                break
            case Char.Punctuation.openParen:
                this.onObjectOpen(curChar, range, pauser)
                break
            case Char.Punctuation.verticalLine:
                this.onNonStringValue(range)
                this.pushContext([StackContextType.TAGGED_UNION, { state: TaggedUnionState.EXPECTING_OPTION }])
                this.oncurrentdata.signal(s => s.onOpenTaggedUnion(range, pauser))
                break
            default:
                this.raiseError(`unknown punctuation: ${String.fromCharCode(curChar)}`, range)
        }
    }
    public onSnippet(chunk: string, begin: number, end: number) {
        if (DEBUG) console.log(`onSnippet`)
        switch (this.currentToken[0]) {
            case TokenType.COMMENT: {
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
                return assertUnreachable(this.currentToken[0])
        }
    }
    public onNewLine(range: Range) {
        if (DEBUG) console.log(`onNewLine`)

        this.oncurrentdata.signal(s => s.onNewLine(range))
    }
    public onLineCommentBegin(range: Range) {
        if (DEBUG) console.log(`onLineCommentBegin`)

        this.setCurrentToken([TokenType.COMMENT, { commentNode: "", start: range }], range)
    }
    public onLineCommentEnd(location: Location, pauser: Pauser) {
        if (DEBUG) console.log(`onLineCommentEnd`)

        if (this.currentToken[0] !== TokenType.COMMENT) {
            throw new ParserStackPanicError(`Unexpected line comment end`, { start: location, end: location })
        }
        const $ = this.currentToken[1]
        this.oncurrentdata.signal(s => s.onLineComment($.commentNode, { start: $.start.start, end: location }, pauser))
        this.unsetCurrentToken({ start: location, end: location })
    }
    public onBlockCommentBegin(range: Range) {
        if (DEBUG) console.log(`onBlockCommentBegin`)

        this.setCurrentToken([TokenType.COMMENT, { commentNode: "", start: range }], range)
    }
    public onBlockCommentEnd(end: Range, pauser: Pauser) {
        if (DEBUG) console.log(`onBlockCommentEnd`)

        if (this.currentToken[0] !== TokenType.COMMENT) {
            throw new ParserStackPanicError(`Unexpected block comment end`, end)
        }
        const $ = this.currentToken[1]
        this.oncurrentdata.signal(s => s.onBlockComment($.commentNode, { start: $.start.start, end: end.end }, pauser))
        this.unsetCurrentToken(end)
    }
    public onUnquotedTokenBegin(location: Location) {
        if (DEBUG) console.log(`onUnquotedTokenBegin`)

        this.setCurrentToken([TokenType.UNQUOTED_TOKEN, { unquotedTokenNode: "", start: location }], { start: location, end: location })
    }
    public onUnquotedTokenEnd(location: Location, pauser: Pauser) {
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
        this.oncurrentdata.signal(s => s.onString(
            $.unquotedTokenNode,
            {
                quote: null,
                terminated: null,
                pauser: pauser,
                range: range,
            }
        ))
        this.wrapupAfterValue(range)
        this.unsetCurrentToken({ start: location, end: location })
    }

    public onWhitespaceBegin(location: Location) {
        if (DEBUG) console.log(`onWhitespaceBegin`)

        this.setCurrentToken([TokenType.WHITESPACE, { whitespaceNode: "", start: location }], { start: location, end: location })
    }
    public onWhitespaceEnd(location: Location) {
        if (DEBUG) console.log(`onWhitespaceEnd`)

        if (this.currentToken[0] !== TokenType.WHITESPACE) {
            throw new ParserStackPanicError(`Unexpected whitespace end`, { start: location, end: location })
        }
        const $ = this.currentToken[1]
        const range = {
            start: $.start,
            end: location,
        }
        this.oncurrentdata.signal(s => s.onWhitespace($.whitespaceNode, range))
        this.unsetCurrentToken({ start: location, end: location })
    }

    public onQuotedStringBegin(begin: Range, quote: string) {
        if (DEBUG) console.log(`onQuotedStringBegin`)
        this.setCurrentToken([TokenType.QUOTED_STRING, { quotedStringNode: "", start: begin, startCharacter: quote }], begin)
    }

    public onQuotedStringEnd(end: Range, quote: string | null, pauser: Pauser) {
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
        const onStringValue = () => {
            this.oncurrentdata.signal(s => s.onString(
                value,
                {
                    //startCharacter: $tok.startCharacter,
                    terminated: quote !== null,
                    range: range,
                    quote: $tok.startCharacter,
                    pauser: pauser,
                }
            ))
            this.wrapupAfterValue(range)
        }
        switch ($[0]) {
            case StackContextType.ARRAY: {
                onStringValue()
                break
            }
            case StackContextType.OBJECT: {
                const $$ = $[1]
                switch ($$.state) {
                    case ObjectState.EXPECTING_KEY:
                        this.oncurrentdata.signal(s => s.onString(
                            value,
                            {
                                range: range,
                                quote: $tok.startCharacter,
                                terminated: quote !== null,
                                pauser: pauser,
                            }
                        ))
                        $$.state = ObjectState.EXPECTING_OBJECT_VALUE

                        break
                    case ObjectState.EXPECTING_OBJECT_VALUE:
                        onStringValue()
                        $$.state = ObjectState.EXPECTING_KEY
                        break
                    default:
                        assertUnreachable($$.state)
                }
                break
            }
            case StackContextType.ROOT: {
                onStringValue()
                this.setRootStateAfterValue($[1])
                break
            }
            case StackContextType.TAGGED_UNION: {
                const $$ = $[1]
                switch ($$.state) {
                    case TaggedUnionState.EXPECTING_OPTION:
                        this.oncurrentdata.signal(s => s.onString(
                            value,
                            {
                                range: range,
                                quote: $tok.startCharacter,
                                terminated: quote !== null,
                                pauser: pauser,
                            }
                        ))
                        $$.state = TaggedUnionState.EXPECTING_VALUE
                        break
                    case TaggedUnionState.EXPECTING_VALUE: {
                        onStringValue()
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
        this.unsetCurrentToken(end)
    }
    private onObjectOpen(curChar: number, range: Range, pauser: Pauser) {
        this.onNonStringValue(range)
        this.pushContext([StackContextType.OBJECT, { state: ObjectState.EXPECTING_KEY, openChar: curChar }])
        this.oncurrentdata.signal(s => s.onOpenObject({
            start: range,
            openCharacter: String.fromCharCode(curChar),
            pauser: pauser,
        }))
    }
    private onObjectClose(curChar: number, range: Range, pauser: Pauser) {
        if (this.currentContext[0] !== StackContextType.OBJECT) {
            this.raiseError("not in an object", range)
            this.oncurrentdata.signal(s => s.onCloseObject({
                range: range,
                closeCharacter: String.fromCharCode(curChar),
                pauser: pauser,
            }))
        } else {
            if (this.currentContext[1].state === ObjectState.EXPECTING_OBJECT_VALUE) {
                this.raiseError("missing property value", range)
            }
            this.oncurrentdata.signal(s => s.onCloseObject({
                range: range,
                closeCharacter: String.fromCharCode(curChar),
                pauser: pauser,
            }))
            this.popContext(range)
        }
    }
    private onArrayOpen(curChar: number, range: Range, pauser: Pauser) {
        this.onNonStringValue(range)
        this.pushContext([StackContextType.ARRAY, { openChar: curChar }])
        this.oncurrentdata.signal(s => s.onOpenArray({
            start: range,
            openCharacter: String.fromCharCode(curChar),
            pauser: pauser,
        }))
    }
    private onArrayClose(curChar: number, range: Range, pauser: Pauser) {
        const $ = this.currentContext
        if ($[0] !== StackContextType.ARRAY) {
            this.raiseError("not in an array", range)
        } else {
            this.popContext(range)
        }
        this.oncurrentdata.signal(s => s.onCloseArray({
            range: range,
            closeCharacter: String.fromCharCode(curChar),
            pauser: pauser,
        }))
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
        this.oncurrentdata = this.ondata
        this.onheaderdata.signal(s => s.onHeaderEnd(range))
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
    public wrapupAfterValue(range: Range) {
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
