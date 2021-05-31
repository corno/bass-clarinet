/* eslint
    camelcase:"off",
    complexity:"off",
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import { Location, Range, getEndLocationFromRange, createRangeFromSingleLocation } from "../../location"
import {
    TreeEvent,
    TreeEventType,
    ITreeParserEventConsumer,
    EndData,
} from "../../interfaces/ITreeParserEventConsumer"
import {
    TreeParserError,
    TreeParserErrorType,
} from "./functions"
import {
    Token,
    TokenType,
    StringData,
    PunctionationData,
    ITreeParser,
    OverheadTokenType,
} from "../../interfaces/ITreeParser"
import * as Char from "../../Characters"
import { StringValueDataType } from "../../interfaces"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}


enum ObjectState {
    EXPECTING_OBJECT_VALUE,
    EXPECTING_KEY,
}
enum TaggedUnionState {
    EXPECTING_OPTION,
    EXPECTING_VALUE,
}

enum StackContextType2 {
    ARRAY,
    OBJECT,
    TAGGED_UNION,
}


type TaggedUnionContext = {
    state: TaggedUnionState
}
type ObjectContext = {
    state: ObjectState
    //readonly openChar: number
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

export function createTreeParser<ReturnType, ErrorType>(
    onerror: (error: TreeParserError, range: Range) => void,
    eventsConsumer: ITreeParserEventConsumer<ReturnType, ErrorType>
): ITreeParser<ReturnType, ErrorType> {


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

    function createEndData(location: Location): EndData {
        return {
            indentation: indentationState.getIndentation(),
            location: location,
        }
    }

    class TreeParser {
        private readonly stack = new Array<StackContext>()
        private currentContext: StackContext | null = null
        private reportUnexpectedStackContext(stackContext: StackContext, location: Location) {
            const range = createRangeFromSingleLocation(location)
            switch (stackContext.type[0]) {
                case StackContextType2.ARRAY: {
                    //const $ = stackContext.type[1]
                    onerror({ type: ["unexpected end of document", { "still in": ["array"] }] }, range)

                    break
                }
                case StackContextType2.OBJECT: {
                    //const $ = stackContext.type[1]
                    onerror({ type: ["unexpected end of document", { "still in": ["object"] }] }, range)

                    break
                }
                case StackContextType2.TAGGED_UNION: {
                    //const $ = stackContext.type[1]
                    onerror({ type: ["unexpected end of document", { "still in": ["tagged union"] }] }, range)

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
            return eventsConsumer.onEnd(aborted, createEndData(location))
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
                return onStackEmpty(eventsConsumer.onEnd(false, createEndData(getEndLocationFromRange(range))))
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
                    switch ($.type[0]) {
                        case OverheadTokenType.Comment: {
                            indentationState.setLineDirty()
                            break
                        }
                        case OverheadTokenType.NewLine: {
                            indentationState.onNewline()

                            break
                        }
                        case OverheadTokenType.WhiteSpace: {
                            const $$ = $.type[1]
                            indentationState.onWhitespace($$.value)

                            break
                        }
                        default:
                            assertUnreachable($.type[0])
                    }
                    return this.sendEvent({
                        annotation: {
                            indentation: indentationState.getIndentation(),
                            tokenString: token.tokenString,
                            range: token.range,

                        },
                        type: [TreeEventType.Overhead, $],
                    })
                }
                case TokenType.Structural: {
                    const $ = token.type[1]
                    indentationState.setLineDirty()
                    return this.onPunctuation(token.range, token.tokenString, $, onStackEmpty)
                }
                case TokenType.String: {
                    const $ = token.type[1]
                    indentationState.setLineDirty()
                    return this.onString(token.range, token.tokenString, $, onStackEmpty)
                }
                default:
                    return assertUnreachable(token.type[0])
            }
        }
        private onString(
            range: Range,
            tokenString: string,
            data: StringData,
            onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {


            if (this.currentContext === null) {
                return onStackEmpty(eventsConsumer.onEnd(false, createEndData(getEndLocationFromRange(range))))
            } else {
                const sendStringValue = (data2: StringData) => {

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

                    return this.sendEvent({
                        annotation: {
                            indentation: indentationState.getIndentation(),
                            tokenString: tokenString,
                            range: range,

                        },
                        type: [TreeEventType.StringValue, {
                            type: ((): StringValueDataType => {
                                switch (data2.type[0]) {
                                    case "multiline": {
                                        const $ = data2.type[1]
                                        return ["multiline", {
                                            lines: trimStringLines($.lines, indentationState.getIndentation()),
                                        }]
                                    }
                                    case "apostrophed": {
                                        //CAST TO QUOTED
                                        const $ = data2.type[1]
                                        return ["quoted", {
                                            value: $.value,
                                        }]
                                    }
                                    case "nonwrapped": {
                                        const $ = data2.type[1]
                                        return ["nonwrapped", {
                                            value: $.value,
                                        }]
                                    }
                                    case "quoted": {
                                        const $ = data2.type[1]
                                        return ["quoted", {
                                            value: $.value,
                                        }]
                                    }
                                    default:
                                        return assertUnreachable(data2.type[0])
                                }
                            })(),
                        }],
                    })
                }
                switch (this.currentContext.type[0]) {
                    case StackContextType2.ARRAY: {
                        return sendStringValue(data)
                    }
                    case StackContextType2.OBJECT: {
                        const $$ = this.currentContext.type[1]

                        switch ($$.state) {
                            case ObjectState.EXPECTING_KEY:
                                $$.state = ObjectState.EXPECTING_OBJECT_VALUE

                                return this.sendEvent({
                                    annotation: {
                                        indentation: indentationState.getIndentation(),
                                        tokenString: tokenString,
                                        range: range,

                                    },
                                    type: [TreeEventType.Identifier, {
                                        name: ((): string => {
                                            switch (data.type[0]) {
                                                case "multiline": {
                                                    //CAST TO APOSTROPHED
                                                    const $ = data.type[1]
                                                    return $.lines.join("\n")
                                                }
                                                case "apostrophed": {
                                                    const $ = data.type[1]
                                                    return $.value
                                                }
                                                case "nonwrapped": {
                                                    //CAST TO APOSTROPHED
                                                    const $ = data.type[1]
                                                    return $.value
                                                }
                                                case "quoted": {
                                                    //CAST TO APOSTROPHED
                                                    const $ = data.type[1]
                                                    return $.value
                                                }
                                                default:
                                                    return assertUnreachable(data.type[0])
                                            }
                                        })(),
                                    }],
                                })

                            case ObjectState.EXPECTING_OBJECT_VALUE:

                                $$.state = ObjectState.EXPECTING_KEY
                                return sendStringValue(data)

                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    case StackContextType2.TAGGED_UNION: {
                        const $$ = this.currentContext.type[1]

                        switch ($$.state) {
                            case TaggedUnionState.EXPECTING_OPTION:
                                $$.state = TaggedUnionState.EXPECTING_VALUE

                                return this.sendEvent({
                                    annotation: {
                                        indentation: indentationState.getIndentation(),

                                        tokenString: tokenString,
                                        range: range,

                                    },
                                    type: [TreeEventType.Identifier, {
                                        name: ((): string => {
                                            switch (data.type[0]) {
                                                case "multiline": {
                                                    //CAST TO APOSTROPHED
                                                    const $ = data.type[1]
                                                    return $.lines.join("\n")
                                                }
                                                case "apostrophed": {
                                                    const $ = data.type[1]
                                                    return $.value
                                                }
                                                case "nonwrapped": {
                                                    //CAST TO APOSTROPHED
                                                    const $ = data.type[1]
                                                    return $.value
                                                }
                                                case "quoted": {
                                                    //CAST TO APOSTROPHED
                                                    const $ = data.type[1]
                                                    return $.value
                                                }
                                                default:
                                                    return assertUnreachable(data.type[0])
                                            }
                                        })(),
                                    }],
                                })
                            case TaggedUnionState.EXPECTING_VALUE: {

                                return sendStringValue(data).mapResult(() => {
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
                        annotation: {
                            indentation: indentationState.getIndentation(),

                            tokenString: tokenString,
                            range: range,

                        },
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
                        annotation: {
                            indentation: indentationState.getIndentation(),

                            tokenString: tokenString,
                            range: range,

                        },
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
                    annotation: {
                        indentation: indentationState.getIndentation(),

                        tokenString: "|",
                        range: range,

                    },
                    type: [TreeEventType.TaggedUnion, {
                    }],
                })

            })
        }
        private sendEvent(data: TreeEvent): p.IValue<boolean> {
            return eventsConsumer.onData(data)
        }
        private onObjectOpen(openCharacter: "(" | "{", range: Range): p.IValue<boolean> {
            return this.onComplexValue(range).mapResult(() => {
                const obj = {
                    state: ObjectState.EXPECTING_KEY,
                    //openChar: curChar,
                }
                this.pushContext({ range: range, type: [StackContextType2.OBJECT, obj] })
                return this.sendEvent({
                    annotation: {
                        indentation: indentationState.getIndentation(),

                        tokenString: openCharacter,
                        range: range,

                    },
                    type: [TreeEventType.OpenObject],
                })

            })
        }
        private onObjectClose(closeCharacter: ")" | "}", range: Range, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            return this.sendEvent({
                annotation: {
                    indentation: indentationState.getIndentation(),

                    tokenString: closeCharacter,
                    range: range,

                },
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
                    annotation: {
                        indentation: indentationState.getIndentation(),

                        tokenString: openCharacter,
                        range: range,

                    },
                    type: [TreeEventType.OpenArray],
                })

            })
        }
        private onArrayClose(closeCharacter: "]" | ">", range: Range, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>) {

            return this.sendEvent({
                annotation: {
                    indentation: indentationState.getIndentation(),

                    tokenString: closeCharacter,
                    range: range,

                },
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
            onerror(
                {
                    type: message,
                },
                range
            )
        }
    }
    return new TreeParser()
}
