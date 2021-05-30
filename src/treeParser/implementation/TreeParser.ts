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

} from "../../parser/TextParserStateTypes"
import { Location, Range, getEndLocationFromRange, createRangeFromSingleLocation } from "../../parser/location"
import { TreeEvent, TreeEventType } from "../../parser/TreeEvent"
import { Token, TokenType, StringData, PunctionationData } from "../api"
import * as Char from "../../parser/Characters"
import { TextParserEventConsumer } from "../../parser/TextParserEventConsumer"
import { ITreeParser } from "../api"

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

export type TreeParserErrorType =
    | ["unexpected end of document", {
        "still in":
        | ["array"]
        | ["object"]
        | ["tagged union"]
    }]
    | ["unexpected '!'"]
    | ["not in an object"]
    | ["not in an array"]
    | ["missing property value"]
    | ["expected option"]
    | ["unknown punctuation", {
        found: string
    }]

export type TreeParserError = {
    type: TreeParserErrorType
}

export function printTreeParserError(error: TreeParserError): string {

    switch (error.type[0]) {
        case "expected option": {
            return `expected option`
        }
        case "missing property value": {
            return `missing property value`
        }
        case "not in an array": {
            return `not in an array`
        }
        case "not in an object": {
            return `not in an object`
        }
        case "unexpected '!'": {
            return `unexpected '!'`
        }
        case "unexpected end of document": {
            const $ = error.type[1]
            return `unexpected end of document, still in ${$["still in"][0]}`
        }
        case "unknown punctuation": {
            const $ = error.type[1]
            return `unknown punctuation: ${$.found}`
        }
        default:
            return assertUnreachable(error.type[0])
    }
}

export function createTreeParser<ReturnType, ErrorType>(
    onerror: (error: TreeParserError, range: Range) => void,
    eventsConsumer: TextParserEventConsumer<ReturnType, ErrorType>
): ITreeParser<ReturnType, ErrorType> {

    class TreeParser {
        private readonly stack = new Array<StackContext>()
        private currentContext: StackContext | null = null
        private readonly onerror: (error: TreeParserError, range: Range) => void
        private readonly eventsConsumer: TextParserEventConsumer<ReturnType, ErrorType>
        constructor(
        ) {
            this.onerror = onerror
            this.eventsConsumer = eventsConsumer
        }
        private reportUnexpectedStackContext(stackContext: StackContext, location: Location) {
            const range = createRangeFromSingleLocation(location)
            switch (stackContext.type[0]) {
                case StackContextType2.ARRAY: {
                    //const $ = stackContext.type[1]
                    this.onerror({ type: ["unexpected end of document", { "still in": ["array"] }] }, range)

                    break
                }
                case StackContextType2.OBJECT: {
                    //const $ = stackContext.type[1]
                    this.onerror({ type: ["unexpected end of document", { "still in": ["object"] }] }, range)

                    break
                }
                case StackContextType2.TAGGED_UNION: {
                    //const $ = stackContext.type[1]
                    this.onerror({ type: ["unexpected end of document", { "still in": ["tagged union"] }] }, range)

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
        public popContext(range: Range, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            const popped = this.stack.pop()
            if (popped === undefined) {
                return onStackEmpty(this.eventsConsumer.onEnd(false, getEndLocationFromRange(range)))
            } else {
                //if (DEBUG) console.log(`popped context ${popped.getDescription()}<${this.getCurrentContext().getDescription()}`)
                this.currentContext = popped

                switch (popped.type[0]) {
                    case StackContextType2.ARRAY:
                        return p.value(false)
                    case StackContextType2.OBJECT:
                        return p.value(false)
                    case StackContextType2.TAGGED_UNION:
                        return this.popContext(range, onStackEmpty)
                    default:
                        return assertUnreachable(popped.type[0])
                }
            }
        }
        /**
         *
         * @param token
         * @param onStackEmpty when this token causes the stack to be empty, this callback is called.
         */
        public onData(
            token: Token,
            onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>
        ): p.IValue<boolean> {
            switch (token.type[0]) {
                case TokenType.Overhead: {
                    const $ = token.type[1]

                    return this.sendEvent({
                        tokenString: token.tokenString,
                        range: token.range,
                        type: [TreeEventType.Overhead, $],
                    })
                }
                case TokenType.Structural: {
                    const $ = token.type[1]

                    return this.onPunctuation(token.range, token.tokenString, $, onStackEmpty)
                }
                case TokenType.String: {
                    const $ = token.type[1]

                    return this.onString(token.range, token.tokenString, $, onStackEmpty)
                }
                default:
                    return assertUnreachable(token.type[0])
            }
        }
        private onString(range: Range, tokenString: string, data: StringData, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {

            const y = (data2: StringData) => {
                return this.sendEvent({
                    tokenString: tokenString,
                    range: range,
                    type: [TreeEventType.String, data2],
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
        public onPunctuation(range: Range, tokenString: string, data: PunctionationData, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            const curChar = data.char
            switch (curChar) {
                case Char.Punctuation.exclamationMark:
                    this.raiseError(["unexpected '!'"], range)
                    return p.value(false)
                case Char.Punctuation.closeAngleBracket:
                    return this.onArrayClose(">", range, onStackEmpty)
                case Char.Punctuation.closeBracket:
                    return this.onArrayClose("]", range, onStackEmpty)
                case Char.Punctuation.comma:
                    //
                    return this.sendEvent({
                        tokenString: tokenString,
                        range: range,
                        type: [TreeEventType.Comma],
                    })
                case Char.Punctuation.openAngleBracket:
                    return this.onArrayOpen("<", range)
                case Char.Punctuation.openBracket:
                    return this.onArrayOpen("[", range)
                case Char.Punctuation.closeBrace:
                    return this.onObjectClose("}", range, onStackEmpty)
                case Char.Punctuation.closeParen:
                    return this.onObjectClose(")", range, onStackEmpty)
                case Char.Punctuation.colon:
                    //
                    return this.sendEvent({
                        tokenString: tokenString,
                        range: range,
                        type: [TreeEventType.Colon],
                    })
                case Char.Punctuation.openBrace:
                    return this.onObjectOpen("{", range)
                case Char.Punctuation.openParen:
                    return this.onObjectOpen("(", range)
                case Char.Punctuation.verticalLine:
                    return this.onTaggedUnion(range)

                default:
                    this.raiseError(
                        ['unknown punctuation', {
                            found: String.fromCharCode(curChar),
                        }],
                        range
                    )
                    return p.value(false)
            }
        }
        private onTaggedUnion(range: Range) {

            const taggedUnion = { state: TaggedUnionState.EXPECTING_OPTION }
            return this.onComplexValue(range).mapResult(() => {
                this.pushContext({ range: range, type: [StackContextType2.TAGGED_UNION, taggedUnion] })
                return this.sendEvent({
                    tokenString: "|",
                    range: range,
                    type: [TreeEventType.TaggedUnion, {
                    }],
                })

            })
        }
        private sendEvent(data: TreeEvent): p.IValue<boolean> {
            return this.eventsConsumer.onData(data)
        }
        private onObjectOpen(openCharacter: "(" | "{", range: Range): p.IValue<boolean> {
            return this.onComplexValue(range).mapResult(() => {
                const obj = {
                    state: ObjectState.EXPECTING_KEY,
                    //openChar: curChar,
                }
                this.pushContext({ range: range, type: [StackContextType2.OBJECT, obj] })
                return this.sendEvent({
                    tokenString: openCharacter,
                    range: range,
                    type: [TreeEventType.OpenObject],
                })

            })
        }
        private onObjectClose(closeCharacter: ")" | "}", range: Range, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            return this.sendEvent({
                tokenString: closeCharacter,
                range: range,
                type: [TreeEventType.CloseObject],
            }).mapResult(() => {
                if (this.currentContext === null || this.currentContext.type[0] !== StackContextType2.OBJECT) {
                    this.raiseError(["not in an object"], range)
                    return p.value(false)
                } else {
                    if (this.currentContext.type[1].state === ObjectState.EXPECTING_OBJECT_VALUE) {
                        this.raiseError(["missing property value"], range)
                    }
                    return this.popContext(range, onEndOfStack)
                }
            })
        }
        private onArrayOpen(openCharacter: "[" | "<", range: Range) {
            return this.onComplexValue(range).mapResult(() => {
                this.pushContext({
                    range: range, type: [StackContextType2.ARRAY, {
                        openChar: openCharacter,
                    }],
                })
                return this.sendEvent({
                    tokenString: openCharacter,
                    range: range,
                    type: [TreeEventType.OpenArray],
                })

            })
        }
        private onArrayClose(closeCharacter: "]" | ">", range: Range, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>) {

            return this.sendEvent({
                tokenString: closeCharacter,
                range: range,
                type: [TreeEventType.CloseArray],
            }).mapResult(() => {
                if (this.currentContext === null || this.currentContext.type[0] !== StackContextType2.ARRAY) {
                    this.raiseError(["not in an array"], range)
                    return p.value(false)
                } else {
                    return this.popContext(range, onEndOfStack)
                }
            })
        }
        private onComplexValue(range: Range): p.IValue<boolean> {
            if (this.currentContext === null) {
                //the beginning of the content
                return p.value(false)
            }
            switch (this.currentContext.type[0]) {
                case StackContextType2.ARRAY: {
                    return p.value(false)
                }
                case StackContextType2.OBJECT: {
                    const $$ = this.currentContext.type[1]
                    switch ($$.state) {
                        case ObjectState.EXPECTING_KEY:
                            return p.value(false)
                        case ObjectState.EXPECTING_OBJECT_VALUE:
                            $$.state = ObjectState.EXPECTING_KEY
                            return p.value(false)
                        default:
                            return assertUnreachable($$.state)
                    }
                }
                case StackContextType2.TAGGED_UNION: {
                    const $$ = this.currentContext.type[1]
                    switch ($$.state) {
                        case TaggedUnionState.EXPECTING_OPTION:
                            this.raiseError(["expected option"], range)
                            return p.value(false)
                        case TaggedUnionState.EXPECTING_VALUE: {
                            return p.value(false)
                        }
                        default:
                            return assertUnreachable($$.state)
                    }
                }
                default:
                    return assertUnreachable(this.currentContext.type[0])
            }

        }
        private raiseError(message: TreeParserErrorType, range: Range) {
            //if (DEBUG) { console.log("error raised:", message, printRange(range)) }
            this.onerror(
                {
                    type: message,
                },
                range
            )
        }
    }
    return new TreeParser()
}
