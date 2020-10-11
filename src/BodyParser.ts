/* eslint
    camelcase:"off",
    complexity:"off",
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import {
    ObjectState,
    TaggedUnionState,
    StackContextType2,
    ObjectContext,
    TaggedUnionContext,

} from "./parserStateTypes"
import { Location, Range, getEndLocationFromRange, createRangeFromSingleLocation } from "./location"
import { BodyEvent, BodyEventType } from "./BodyEvent"
import { Token, TokenType, SimpleValueData, PunctionationData } from "./Token"
import * as Char from "./Characters"
import { ParserEventConsumer } from "./createParser"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type StackContext = {
    range: Range
    type:
    | [StackContextType2.ARRAY, {
        //
    }]
    | [StackContextType2.OBJECT, ObjectContext]
    | [StackContextType2.TAGGED_UNION, TaggedUnionContext]
}

export class BodyParser<ReturnType, ErrorType> {
    private readonly stack = new Array<StackContext>()
    private currentContext: StackContext | null = null
    private readonly onerror: (message: string, range: Range) => void
    private readonly eventsConsumer: ParserEventConsumer<ReturnType, ErrorType>
    constructor(
        onerror: (message: string, range: Range) => void,
        eventsConsumer: ParserEventConsumer<ReturnType, ErrorType>
    ) {
        this.onerror = onerror
        this.eventsConsumer = eventsConsumer
    }
    private reportUnexpectedStackContext(stackContext: StackContext, location: Location) {
        const range = createRangeFromSingleLocation(location)
        switch (stackContext.type[0]) {
            case StackContextType2.ARRAY: {
                //const $ = stackContext.type[1]
                this.onerror("unexpected end of document, still in array", range)

                break
            }
            case StackContextType2.OBJECT: {
                //const $ = stackContext.type[1]
                this.onerror("unexpected end of document, still in object", range)

                break
            }
            case StackContextType2.TAGGED_UNION: {
                //const $ = stackContext.type[1]
                this.onerror("unexpected end of document, still in tagged union", range)

                break
            }
            default:
                assertUnreachable(stackContext.type[0])
        }
    }
    public forceEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> {
        if (!aborted) {
            if (this.currentContext !== null) {
                this.reportUnexpectedStackContext(this.currentContext, location)
            }
            this.currentContext = null
            while (true) {
                const popped = this.stack.pop()
                if (popped === undefined) {
                    break
                } else {
                    this.reportUnexpectedStackContext(popped, location)
                }
            }
        }
        return this.eventsConsumer.onEnd(aborted, location)
    }
    public pushContext(context: StackContext): void {
        //if (DEBUG) console.log(`pushed context ${this.getCurrentContext().getDescription()}>${context.getDescription()}`)
        if (this.currentContext !== null) {
            this.stack.push(this.currentContext)
        }
        this.currentContext = context
    }
    public popContext(range: Range, onEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
        const popped = this.stack.pop()
        if (popped === undefined) {
            return onEmpty(this.eventsConsumer.onEnd(false, getEndLocationFromRange(range)))
        } else {
            //if (DEBUG) console.log(`popped context ${popped.getDescription()}<${this.getCurrentContext().getDescription()}`)
            this.currentContext = popped

            switch (popped.type[0]) {
                case StackContextType2.ARRAY:
                    return p.result(false)
                case StackContextType2.OBJECT:
                    return p.result(false)
                case StackContextType2.TAGGED_UNION:
                    return this.popContext(range, onEmpty)
                default:
                    return assertUnreachable(popped.type[0])
            }
        }
    }
    public onData(data: Token, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
        switch (data.type[0]) {
            case TokenType.Overhead: {
                const $ = data.type[1]

                return this.sendEvent({
                    range: data.range,
                    type: [BodyEventType.Overhead, $],
                })
            }
            case TokenType.Punctuation: {
                const $ = data.type[1]

                return this.onPunctuation(data.range, $, onStackEmpty)
            }
            case TokenType.SimpleValue: {
                const $ = data.type[1]

                return this.onSimpleValue(data.range, $, onStackEmpty)
            }
            default:
                return assertUnreachable(data.type[0])
        }
    }
    private onSimpleValue(range: Range, data: SimpleValueData, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {

        const y = (data2: SimpleValueData) => {
            return this.sendEvent({
                range: range,
                type: [BodyEventType.SimpleValue, data2],
            })
        }

        if (this.currentContext === null) {
            return onStackEmpty(this.eventsConsumer.onEnd(false, getEndLocationFromRange(range)))
        } else {

            switch (this.currentContext.type[0]) {
                case StackContextType2.ARRAY: {
                    return y(data)
                }
                case StackContextType2.OBJECT: {
                    const $$ = this.currentContext.type[1]

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
                    const $$ = this.currentContext.type[1]

                    switch ($$.state) {
                        case TaggedUnionState.EXPECTING_OPTION:
                            $$.state = TaggedUnionState.EXPECTING_VALUE
                            return y(data)
                        case TaggedUnionState.EXPECTING_VALUE: {
                            return y(data).mapResult(() => {
                                return this.popContext(range, onStackEmpty)
                            })
                        }
                        default:
                            return assertUnreachable($$.state)
                    }
                }
                default:
                    return assertUnreachable(this.currentContext.type[0])
            }
        }

    }
    public onPunctuation(range: Range, data: PunctionationData, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
        const curChar = data.char
        switch (curChar) {
            case Char.Punctuation.exclamationMark:
                this.raiseError("unexpected !", range)
                return p.result(false)
            case Char.Punctuation.hash:
                this.raiseError("unexpected '#'", range)
                return p.result(false)
            case Char.Punctuation.closeAngleBracket:
                return this.onArrayClose(curChar, range, onStackEmpty)
            case Char.Punctuation.closeBracket:
                return this.onArrayClose(curChar, range, onStackEmpty)
            case Char.Punctuation.comma:
                //
                return this.sendEvent({
                    range: range,
                    type: [BodyEventType.Comma, {
                    }],
                })
            case Char.Punctuation.openAngleBracket:
                return this.onArrayOpen(curChar, range)
            case Char.Punctuation.openBracket:
                return this.onArrayOpen(curChar, range)
            case Char.Punctuation.closeBrace:
                return this.onObjectClose(curChar, range, onStackEmpty)
            case Char.Punctuation.closeParen:
                return this.onObjectClose(curChar, range, onStackEmpty)
            case Char.Punctuation.colon:
                //
                return this.sendEvent({
                    range: range,
                    type: [BodyEventType.Colon, {
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
    private onTaggedUnion(range: Range) {

        const taggedUnion = { state: TaggedUnionState.EXPECTING_OPTION }
        return this.onComplexValue(range).mapResult(() => {
            this.pushContext({ range: range, type: [StackContextType2.TAGGED_UNION, taggedUnion] })
            return this.sendEvent({
                range: range,
                type: [BodyEventType.TaggedUnion, {
                }],
            })

        })
    }
    private sendEvent(data: BodyEvent): p.IValue<boolean> {
        return this.eventsConsumer.onData(data)
    }
    private onObjectOpen(curChar: number, range: Range): p.IValue<boolean> {
        return this.onComplexValue(range).mapResult(() => {
            const obj = {
                state: ObjectState.EXPECTING_KEY, openChar: curChar,
            }
            this.pushContext({ range: range, type: [StackContextType2.OBJECT, obj] })
            return this.sendEvent({
                range: range,
                type: [BodyEventType.OpenObject, {
                    openCharacter: String.fromCharCode(curChar),
                }],
            })

        })
    }
    private onObjectClose(curChar: number, range: Range, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
        return this.sendEvent({
            range: range,
            type: [BodyEventType.CloseObject, {
                closeCharacter: String.fromCharCode(curChar),
            }],
        }).mapResult(() => {
            if (this.currentContext === null || this.currentContext.type[0] !== StackContextType2.OBJECT) {
                this.raiseError("not in an object", range)
                return p.result(false)
            } else {
                if (this.currentContext.type[1].state === ObjectState.EXPECTING_OBJECT_VALUE) {
                    this.raiseError("missing property value", range)
                }
                return this.popContext(range, onEndOfStack)
            }
        })
    }
    private onArrayOpen(curChar: number, range: Range) {
        return this.onComplexValue(range).mapResult(() => {
            this.pushContext({ range: range, type: [StackContextType2.ARRAY, { openChar: curChar }] })
            return this.sendEvent({
                range: range,
                type: [BodyEventType.OpenArray, {
                    openCharacter: String.fromCharCode(curChar),
                }],
            })

        })
    }
    private onArrayClose(curChar: number, range: Range, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>) {

        return this.sendEvent({
            range: range,
            type: [BodyEventType.CloseArray, {
                closeCharacter: String.fromCharCode(curChar),
            }],
        }).mapResult(() => {
            if (this.currentContext === null || this.currentContext.type[0] !== StackContextType2.ARRAY) {
                this.raiseError("not in an array", range)
                return p.result(false)
            } else {
                return this.popContext(range, onEndOfStack)
            }
        })
    }
    private onComplexValue(range: Range): p.IValue<boolean> {
        if (this.currentContext === null) {
            //the beginning of the content
            return p.result(false)
        }
        switch (this.currentContext.type[0]) {
            case StackContextType2.ARRAY: {
                return p.result(false)
            }
            case StackContextType2.OBJECT: {
                const $$ = this.currentContext.type[1]
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
                const $$ = this.currentContext.type[1]
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
                return assertUnreachable(this.currentContext.type[0])
        }

    }
    private raiseError(message: string, range: Range) {
        //if (DEBUG) { console.log("error raised:", message, printRange(range)) }
        this.onerror(message, range)
    }
}
