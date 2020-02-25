/* eslint
    @typescript-eslint/camelcase: "off",
    camelcase:"off",
    complexity:"off",
    no-console:"off",
    max-classes-per-file:"off",
*/

import * as subscr from "./subscription"
import * as Char from "./Characters"
import { IParser } from "./Tokenizer"

import {
    RootState,
    ObjectState,
    ComplexValueType,
    TaggedUnionState,
    StackContext,
    StackContextType,
    ExpectedType,
    Context,
    ContextType,
} from "./parserStateTypes"
import { Location, Range, printRange } from "./location"
import { ParserOptions, Allow } from "./configurationTypes"
import { RangeError } from "./errors"

export const DEBUG = false
export const INFO = false


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
                case RootState.EXPECTING_ROOTVALUE_WITHOUT_HEADER: return "EXPECTING_ROOTVALUE_WITHOUT_HEADER"
                case RootState.EXPECTING_ROOTVALUE_AFTER_HEADER: return "EXPECTING_ROOTVALUE_AFTER_HEADER"
                case RootState.EXPECTING_HASH_OR_ROOTVALUE: return "EXPECTING_ROOTVALUE_OR_HASH"
                case RootState.EXPECTING_SCHEMA_START: return "EXPECTING_SCHEMA_START"
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
                case TaggedUnionState.EXPECTING_OPTION: return "EXPECTING_STRING"
                case TaggedUnionState.EXPECTING_VALUE: return "EXPECTING_VALUE"
                default: return assertUnreachable(stackContext[1].state)
            }
        }
        default:
            return assertUnreachable(stackContext[0])
    }
}

export const lax: Allow = {
    comments: true,
    trailing_commas: true,
    parens_instead_of_braces: true,
    missing_commas: true,
    apostrophes_instead_of_quotation_marks: true,
    angle_brackets_instead_of_brackets: true,
    tagged_unions: true,
    schema: true,
    compact: true,
}

export interface DataSubscriber {
    oncomma(range: Range): void
    oncolon(range: Range): void

    onopenarray(range: Range, openCharacter: string): void
    onclosearray(range: Range, closeCharacter: string): void

    onopentaggedunion(range: Range): void
    onclosetaggedunion(location: Location): void
    onoption(option: string, range: Range): void

    onopenobject(range: Range, openCharacter: string): void
    oncloseobject(range: Range, closeCharacter: string): void
    onkey(key: string, range: Range): void

    onquotedstring(value: string, quote: string, range: Range): void
    onunquotedtoken(value: string, range: Range): void

    onblockcomment(comment: string, range: Range, indent: string | null): void
    onlinecomment(comment: string, range: Range): void
    onend(location: Location): void
}

export type DataSubscription = subscr.Subscribers<DataSubscriber>

export interface HeaderSubscriber {
    onheaderstart(): void
    onschemastart(range: Range): void
    oncompact(range: Range): void
    onheaderend(range: Range): void
}

export class Parser implements IParser {
    public readonly stack = new Array<StackContext>()
    public currentContext: StackContext
    public readonly opt: ParserOptions
    readonly onschemadata = new subscr.Subscribers<DataSubscriber>()
    readonly ondata = new subscr.Subscribers<DataSubscriber>()
    public oncurrentdata: subscr.Subscribers<DataSubscriber>
    readonly onheaderdata = new subscr.Subscribers<HeaderSubscriber>()
    private state: Context = [ContextType.STACK]

    private readonly onerror: (message: string, range: Range) => void
    constructor(onerror: (message: string, range: Range) => void, opt?: ParserOptions) {
        this.onerror = onerror
        this.opt = opt || {}
        this.oncurrentdata = this.ondata
        if (this.opt.require?.schema) {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_SCHEMA_START }]
        } else if (this.opt.allow?.schema) {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE }]
        } else {
            this.currentContext = [StackContextType.ROOT, { state: RootState.EXPECTING_ROOTVALUE_WITHOUT_HEADER }]
        }
    }
    public assertIsEnded(location: Location) {
        if (this.currentContext[0] !== StackContextType.ROOT
            || this.currentContext[1].state !== RootState.EXPECTING_END
            || this.stack.length !== 0
        ) {
            this.raiseError("unexpected end of document", { start: location, end: location })
            return
        }

        this.oncurrentdata.signal(s => s.onend(location))
    }
    public onPunctuation(curChar: number, range: Range) {
        const $ = this.currentContext

        function getComplexValueType(): ComplexValueType | null {
            if (curChar === Char.Object.openBrace || curChar === Char.Object.openParen) {
                return ComplexValueType.OBJECT
            } else if (curChar === Char.Array.openBracket || curChar === Char.Array.openAngleBracket) {
                return ComplexValueType.ARRAY
            } else if (curChar === Char.TaggedUnion.verticalLine) { //extension to strict JSON specifications
                return ComplexValueType.TAGGED_UNION
            } else {
                return null
            }
        }
        const vt = getComplexValueType()
        if (curChar === Char.Object.comma) {
            this.oncurrentdata.signal(s => s.oncomma(range))
        } else if (curChar === Char.Object.colon) {
            this.oncurrentdata.signal(s => s.oncolon(range))
        } else if (curChar === Char.Array.closeBracket || curChar === Char.Array.closeAngleBracket) {
            if ($[0] !== StackContextType.ARRAY) {
                this.raiseError("not in an array", range)
            } else {
                this.oncurrentdata.signal(s => s.onclosearray(range, String.fromCharCode(curChar)))
                this.popContext(range.end)
            }
        } else if (curChar === Char.Object.closeBrace || curChar === Char.Object.closeParen) {
            if ($[0] !== StackContextType.OBJECT) {
                this.raiseError("not in an object", range)
            } else {
                if ($[1].state === ObjectState.EXPECTING_OBJECT_VALUE) {
                    this.raiseError("missing property value", range)
                }
                this.oncurrentdata.signal(s => s.oncloseobject(range, String.fromCharCode(curChar)))
                this.popContext(range.end)
            }
        } else if (vt !== null) {
            const expected = this.getExpected()
            switch (expected) {
                case ExpectedType.KEY: {
                    this.raiseError("expected key", range)
                    break
                }
                case ExpectedType.OPTION: {
                    this.raiseError("expected option", range)
                    break
                }
                case ExpectedType.VALUE: {
                    break
                }
                default:
                    return assertUnreachable(expected)
            }
            this.setStateBeforeValue(range)

            switch (vt) {
                case ComplexValueType.ARRAY: {
                    this.oncurrentdata.signal(s => s.onopenarray(range, String.fromCharCode(curChar)))
                    this.pushContext([StackContextType.ARRAY, { openChar: curChar }])
                    break
                }
                case ComplexValueType.OBJECT: {
                    this.oncurrentdata.signal(s => s.onopenobject(range, String.fromCharCode(curChar)))
                    this.pushContext([StackContextType.OBJECT, { state: ObjectState.EXPECTING_KEY, openChar: curChar }])
                    break
                }
                case ComplexValueType.TAGGED_UNION: {
                    this.pushContext([StackContextType.TAGGED_UNION, { state: TaggedUnionState.EXPECTING_OPTION }])
                    this.oncurrentdata.signal(s => s.onopentaggedunion(range))
                    break
                }
                default:
                    return assertUnreachable(vt)
            }
        } else {
            switch ($[0]) {
                case StackContextType.ARRAY: {
                    this.raiseError("expected a value after a comma", range)
                    break
                }
                case StackContextType.OBJECT: {
                    const $$ = $[1]
                    switch ($$.state) {
                        case ObjectState.EXPECTING_KEY:
                            this.raiseError(`Malformed key, should start with '"' or '''`, range)
                            break
                        case ObjectState.EXPECTING_OBJECT_VALUE:
                            this.raiseError("expected a value after a ':'", range)
                            break
                        default:
                            return assertUnreachable($$.state)
                    }
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
                            this.oncurrentdata = this.ondata

                            if (curChar === Char.Header.hash) {

                                if (!this.opt.allow?.compact) {
                                    this.raiseError("compact not allowed", range)
                                } else {
                                    this.onheaderdata.signal(s => s.oncompact(range))
                                    $$.state = RootState.EXPECTING_ROOTVALUE_AFTER_HEADER
                                }
                                this.onheaderdata.signal(s => s.onheaderend(range))
                            } else {
                                this.onheaderdata.signal(s => s.onheaderend(range))
                                this.raiseError("expected a hash ('#') or the root value", range)
                            }
                            break
                        }
                        case RootState.EXPECTING_SCHEMA: {
                            this.raiseError("expected the schema", range)
                            break
                        }
                        case RootState.EXPECTING_ROOTVALUE_AFTER_HEADER: {
                            this.raiseError("expected the root value", range)
                            break
                        }
                        case RootState.EXPECTING_ROOTVALUE_WITHOUT_HEADER: {
                            this.raiseError("expected the root value", range)
                            break
                        }
                        case RootState.EXPECTING_SCHEMA_START:
                            if (curChar !== Char.Header.exclamationMark) {
                                this.raiseError("expected schema start (!)", range)
                            } else {
                                this.onheaderdata.signal(s => s.onheaderstart())
                                this.onheaderdata.signal(s => s.onschemastart(range))
                                this.oncurrentdata = this.onschemadata
                                $$.state = RootState.EXPECTING_SCHEMA
                            }
                            break
                        case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                            if (curChar === Char.Header.exclamationMark) {
                                $$.state = RootState.EXPECTING_SCHEMA
                                this.onheaderdata.signal(s => s.onheaderstart())
                                this.onheaderdata.signal(s => s.onschemastart(range))
                                this.oncurrentdata = this.onschemadata
                            } else {
                                this.raiseError("expected an '!' (to specify a schema) or a value", range)
                            }
                            break
                        default:
                            return assertUnreachable($$.state)
                    }
                    break
                }
                case StackContextType.TAGGED_UNION: {
                    const $$ = $[1]
                    switch ($$.state) {
                        case TaggedUnionState.EXPECTING_OPTION:
                            this.raiseError("missing tagged union string", range)
                            break
                        case TaggedUnionState.EXPECTING_VALUE: {
                            this.raiseError("expected the data of the union type", range)
                            break
                        }
                        default:
                            return assertUnreachable($$.state)
                    }
                    break
                }
                default:
                    return assertUnreachable($[0])
            }
        }
    }
    public onSnippet(chunk: string, begin: number, end: number) {
        switch (this.state[0]) {
            case ContextType.COMMENT: {
                const $ = this.state[1]
                $.commentNode += chunk.substring(begin, end)
                break
            }
            case ContextType.QUOTED_STRING: {
                const $ = this.state[1]
                $.quotedStringNode += chunk.substring(begin, end)
                break
            }
            case ContextType.STACK: {
                throw new Error(`unexpected chunk`)
            }
            case ContextType.UNQUOTED_TOKEN: {
                const $ = this.state[1]
                $.unquotedTokenNode += chunk.substring(begin, end)
                break
            }
            default:
                return assertUnreachable(this.state[0])
        }
    }
    public onLineCommentBegin(range: Range) {
        this.setState([ContextType.COMMENT, { commentNode: "", start: range, indent: null}], range)
    }
    public onLineCommentEnd(location: Location) {
        if (this.state[0] !== ContextType.COMMENT) {
            throw new ParserStackPanicError(`Unexpected line comment end`, {start: location, end: location})
        }
        const $ = this.state[1]
        this.oncurrentdata.signal(s => s.onlinecomment($.commentNode, { start: $.start.start, end: location}))
        this.unsetState({start: location, end: location})
    }
    public onBlockCommentBegin(range: Range, indent: null | string) {
        this.setState([ContextType.COMMENT, { commentNode: "", start: range, indent: indent}], range)
    }
    public onBlockCommentEnd(end: Range) {
        if (this.state[0] !== ContextType.COMMENT) {
            throw new ParserStackPanicError(`Unexpected block comment end`, end)
        }
        const $ = this.state[1]
        this.oncurrentdata.signal(s => s.onblockcomment($.commentNode, { start: $.start.start, end: end.end}, $.indent))
        this.unsetState(end)
    }
    public onUnquotedTokenBegin(location: Location) {
        this.setState([ContextType.UNQUOTED_TOKEN, { unquotedTokenNode: "", start: location }], {start: location, end: location})
    }
    public onUnquotedTokenEnd(location: Location) {
        if (this.state[0] !== ContextType.UNQUOTED_TOKEN) {
            throw new ParserStackPanicError(`Unexpected unquoted token end`, {start: location, end: location} )
        }
        const $ = this.state[1]
        const range = {
            start: $.start,
            end: location,
        }
        this.setStateBeforeValue(range)
        this.oncurrentdata.signal(s => s.onunquotedtoken($.unquotedTokenNode, range))
        this.setStateAfterValue(range.end)
        this.unsetState({start: location, end: location})
    }

    public onQuotedStringBegin(begin: Range, quote: string) {
        this.setState([ContextType.QUOTED_STRING, { quotedStringNode: "", start: begin, startCharacter: quote }], begin)
    }

    public onQuotedStringEnd(end: Range, _quote: string) {
        if (this.state[0] !== ContextType.QUOTED_STRING) {
            throw new ParserStackPanicError(`Unexpected unquoted token end`, end)
        }
        const $ = this.state[1]
        const value = $.quotedStringNode
        const range = {
            start: $.start.start,
            end: end.end,
        }
        const expected = this.getExpected()
        this.setStateBeforeValue(range)
        switch (expected) {
            case ExpectedType.KEY: {
                this.oncurrentdata.signal(s => s.onkey(value, range))
                break
            }
            case ExpectedType.OPTION: {
                this.oncurrentdata.signal(s => s.onoption(value, range))
                break
            }
            case ExpectedType.VALUE: {
                this.oncurrentdata.signal(s => s.onquotedstring(value, $.startCharacter, range))
                this.setStateAfterValue(range.end)
                break
            }
            default:
                return assertUnreachable(expected)
        }
        this.unsetState(end)
    }
    private setState(contextType: Context, range: Range) {
        if (this.state[0] !== ContextType.STACK) {
            throw new ParserStackPanicError(`unexpected start of state`, range)
        }
        this.state = contextType
    }
    private unsetState(range: Range) {
        if (this.state[0] === ContextType.STACK) {
            throw new ParserStackPanicError(`unexpected, parser is already in 'stack' mode`, range)
        }
        this.state = [ContextType.STACK]
    }
    private getExpected(): ExpectedType {
        const $ = this.currentContext
        switch ($[0]) {
            case StackContextType.ARRAY: {
                return ExpectedType.VALUE
            }
            case StackContextType.OBJECT: {
                const $$ = $[1]
                switch ($$.state) {
                    case ObjectState.EXPECTING_KEY:
                        return ExpectedType.KEY
                    case ObjectState.EXPECTING_OBJECT_VALUE:
                        return ExpectedType.VALUE
                    default:
                        return assertUnreachable($$.state)
                }
            }
            case StackContextType.ROOT: {
                return ExpectedType.VALUE
            }
            case StackContextType.TAGGED_UNION: {
                const $$ = $[1]
                switch ($$.state) {
                    case TaggedUnionState.EXPECTING_OPTION:
                        return ExpectedType.OPTION
                    case TaggedUnionState.EXPECTING_VALUE: {
                        return ExpectedType.VALUE
                    }
                    default:
                        return assertUnreachable($$.state)
                }
            }
            default:
                return assertUnreachable($[0])
        }
    }
    private setStateBeforeValue(range: Range) {
        const $ = this.currentContext
        switch ($[0]) {
            case StackContextType.ARRAY: {
                break
            }
            case StackContextType.OBJECT: {
                const $$ = $[1]
                switch ($$.state) {
                    case ObjectState.EXPECTING_KEY:
                        $$.state = ObjectState.EXPECTING_OBJECT_VALUE
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
                const $$ = $[1]
                switch ($$.state) {
                    case RootState.EXPECTING_END: {
                        this.raiseError(`Unexpected data after end`, range)
                        break
                    }
                    case RootState.EXPECTING_HASH_OR_ROOTVALUE: {
                        this.oncurrentdata = this.ondata
                        this.onheaderdata.signal(s => s.onheaderend(range))
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
                    case RootState.EXPECTING_ROOTVALUE_WITHOUT_HEADER: {
                        this.onheaderdata.signal(s => s.onheaderstart())
                        this.onheaderdata.signal(s => s.onheaderend(range))
                        $$.state = RootState.EXPECTING_END
                        break
                    }
                    case RootState.EXPECTING_SCHEMA_START:
                        this.raiseError("expecting schema start (!)", range)
                        $$.state = RootState.EXPECTING_END // this is only expected after processing the value
                        break
                    case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE:
                        this.onheaderdata.signal(s => s.onheaderstart())
                        this.onheaderdata.signal(s => s.onheaderend(range))
                        $$.state = RootState.EXPECTING_END
                        break
                    default:
                        assertUnreachable($$.state)
                }
                break
            }
            case StackContextType.TAGGED_UNION: {
                const $$ = $[1]
                switch ($$.state) {
                    case TaggedUnionState.EXPECTING_OPTION:
                        $$.state = TaggedUnionState.EXPECTING_VALUE
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
    public setStateAfterValue(location: Location) {
        const currentContext = this.currentContext
        switch (currentContext[0]) {
            case StackContextType.ARRAY:
                break
            case StackContextType.OBJECT:
                break
            case StackContextType.ROOT:
                break
            case StackContextType.TAGGED_UNION:
                this.oncurrentdata.signal(s => s.onclosetaggedunion(location))
                this.popContext(location)
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
        this.stack.push(this.currentContext)
        if (DEBUG) console.log(`pushed context ${getContextDescription(this.currentContext)}>${getContextDescription(context)}`)
        this.currentContext = context
    }
    private popContext(location: Location) {
        const popped = this.stack.pop()
        if (popped === undefined) {
            throw new ParserStackPanicError("unexpected end of stack", { start: location, end: location})
        } else {
            if (DEBUG) console.log(`popped context ${getContextDescription(popped)}<${getContextDescription(this.currentContext)}`)
            this.currentContext = popped
            this.setStateAfterValue(location)
        }
    }
}
