/* eslint
    camelcase:"off",
    complexity:"off",
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import * as core from "astn-core"
import {
    TreeParserError,
    TreeParserErrorType,
} from "./functions"
import {
    Token,
    TokenType,
    SimpleStringData,
    PunctionationData,
    ITreeParser,
    MultilineStringData,
} from "../../interfaces/ITreeParser"
import * as Char from "../../generic/characters"

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
    type:
    | ["dictionary", {
        //
    }]
    | ["verbose type"]
    //readonly openChar: number
}

export function createTreeParser<Annotation, ReturnType, ErrorType>(
    onerror: ($: {
        error: TreeParserError
        annotation: Annotation
    }) => void,
    eventsConsumer: core.ITreeBuilder<Annotation, ReturnType, ErrorType>
): ITreeParser<Annotation, ReturnType, ErrorType> {

    type StackContext = {
        annotation: Annotation
        type:
        | [StackContextType2.ARRAY, {
            type:
            | ["list", {
                //
            }]
            | ["shorthand type"]
        }]
        | [StackContextType2.OBJECT, ObjectContext]
        | [StackContextType2.TAGGED_UNION, TaggedUnionContext]
    }

    // class IndentationState {
    //     private indentation = ""
    //     private lineIsDirty = false
    //     setLineDirty() {
    //         this.lineIsDirty = true
    //     }
    //     onWhitespace(value: string) {
    //         if (!this.lineIsDirty) {
    //             this.indentation = value
    //         }
    //     }
    //     onNewline() {
    //         this.indentation = ""
    //         this.lineIsDirty = false
    //     }
    //     getIndentation() {
    //         return this.indentation
    //     }
    // }

    //const indentationState = new IndentationState()

    function raiseError(message: TreeParserErrorType, annotation: Annotation) {
        //if (DEBUG) { console.log("error raised:", message, printRange(range)) }
        onerror({
            error: {
                type: message,
            },
            annotation: annotation,
        })
    }
    const stack = new Array<StackContext>()
    let currentContext: StackContext | null = null

    class TreeParser {
        public forceEnd(aborted: boolean, annotation: Annotation): p.IUnsafeValue<ReturnType, ErrorType> {
            // const annotation = {
            //     tokenString: "FIXME",
            //     indentation: indentationState.getIndentation(),
            //     range: createRangeFromSingleLocation(location),
            //     contextData: {
            //         before: {
            //             comments: [],
            //         },
            //         lineCommentAfter: null,
            //     },
            // }

            function reportUnexpectedStackContext(stackContext: StackContext) {
                switch (stackContext.type[0]) {
                    case StackContextType2.ARRAY: {
                        //const $ = stackContext.type[1]
                        raiseError(["unexpected end of text", { "still in": ["array"] }], annotation)

                        break
                    }
                    case StackContextType2.OBJECT: {
                        //const $ = stackContext.type[1]
                        raiseError(["unexpected end of text", { "still in": ["object"] }], annotation)

                        break
                    }
                    case StackContextType2.TAGGED_UNION: {
                        //const $ = stackContext.type[1]
                        raiseError(["unexpected end of text", { "still in": ["tagged union"] }], annotation)

                        break
                    }
                    default:
                        assertUnreachable(stackContext.type[0])
                }
            }
            if (!aborted) {
                if (currentContext !== null) {
                    reportUnexpectedStackContext(currentContext)
                }
                currentContext = null
                while (true) {
                    const popped = stack.pop()
                    if (popped === undefined) {
                        break
                    } else {
                        reportUnexpectedStackContext(popped)
                    }
                }
            }
            return eventsConsumer.onEnd(
                aborted,
                // {
                //     tokenString: "",
                //     indentation: indentationState.getIndentation(),
                //     range: createRangeFromSingleLocation(location),
                //     contextData: {
                //         before: {
                //             comments: [],
                //         },
                //         lineCommentAfter: null,
                //     },
                // }
                annotation,
            )
        }
        public pushContext(context: StackContext): void {
            //if (DEBUG) console.log(`pushed context ${this.getCurrentContext().getDescription()}>${context.getDescription()}`)
            if (currentContext !== null) {
                stack.push(currentContext)
            }
            currentContext = context
        }
        public popContext(annotation: Annotation, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            const popped = stack.pop()
            if (popped === undefined) {
                return onStackEmpty(eventsConsumer.onEnd(false, annotation))
            } else {
                //if (DEBUG) console.log(`popped context ${popped.getDescription()}<${this.getCurrentContext().getDescription()}`)
                currentContext = popped

                switch (popped.type[0]) {
                    case StackContextType2.ARRAY:
                        return p.value(false)
                    case StackContextType2.OBJECT:
                        return p.value(false)
                    case StackContextType2.TAGGED_UNION:
                        return this.popContext(annotation, onStackEmpty)
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
            token: Token<Annotation>,
            onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>
        ): p.IValue<boolean> {

            // const annotation = {
            //     tokenString: token.tokenString,
            //     indentation: indentationState.getIndentation(),
            //     range: token.range,
            //     contextData: {
            //         before: {
            //             comments: [],
            //         },
            //         lineCommentAfter: null,
            //     },
            // }

            switch (token.type[0]) {
                // case TokenType.Overhead: {
                //     const $ = token.type[1]
                //     switch ($.type[0]) {
                //         case OverheadTokenType.Comment: {
                //             indentationState.setLineDirty()
                //             break
                //         }
                //         case OverheadTokenType.NewLine: {
                //             indentationState.onNewline()

                //             break
                //         }
                //         case OverheadTokenType.WhiteSpace: {
                //             const $$ = $.type[1]
                //             indentationState.onWhitespace($$.value)

                //             break
                //         }
                //         default:
                //             assertUnreachable($.type[0])
                //     }
                //     return p.value(false)
                // }
                case TokenType.Structural: {
                    const $ = token.type[1]

                    //indentationState.setLineDirty()
                    return this.onPunctuation(token.annotation, $, onStackEmpty)
                }
                case TokenType.SimpleString: {
                    const $ = token.type[1]
                    //indentationState.setLineDirty()
                    return this.onSimpleString(token.annotation, $, onStackEmpty)
                }
                case TokenType.MultilineString: {
                    const $ = token.type[1]
                    //indentationState.setLineDirty()
                    return this.onMultilineString(token.annotation, $, onStackEmpty)
                }
                default:
                    return assertUnreachable(token.type[0])
            }
        }
        private onMultilineString(
            annotation: Annotation,
            data: MultilineStringData,
            onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {


            if (currentContext === null) {
                return onStackEmpty(eventsConsumer.onEnd(false, annotation))
            } else {
                const sendStringValue = (data2: MultilineStringData) => {


                    return eventsConsumer.onData({
                        annotation: annotation,
                        type: ["multiline string", {
                            // lines: trimStringLines(data2.lines, indentationState.getIndentation()),
                            lines: data2.lines,
                        }],
                    })
                }
                switch (currentContext.type[0]) {
                    case StackContextType2.ARRAY: {
                        return sendStringValue(data)
                    }
                    case StackContextType2.OBJECT: {
                        const $$ = currentContext.type[1]

                        switch ($$.state) {
                            case ObjectState.EXPECTING_KEY:

                                raiseError(["expected key"], annotation)
                                return p.value(false)

                            case ObjectState.EXPECTING_OBJECT_VALUE:

                                $$.state = ObjectState.EXPECTING_KEY
                                return sendStringValue(data)

                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    case StackContextType2.TAGGED_UNION: {
                        const $$ = currentContext.type[1]

                        switch ($$.state) {
                            case TaggedUnionState.EXPECTING_OPTION:
                                raiseError(["expected option"], annotation)
                                return p.value(false)
                            case TaggedUnionState.EXPECTING_VALUE: {
                                return sendStringValue(data).mapResult(() => {
                                    return this.popContext(annotation, onStackEmpty)
                                })
                            }
                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    default:
                        return assertUnreachable(currentContext.type[0])
                }
            }

        }
        private onSimpleString(
            annotation: Annotation,
            data: SimpleStringData,
            onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {


            if (currentContext === null) {
                return onStackEmpty(eventsConsumer.onEnd(false, annotation))
            } else {
                const sendStringValue = (data2: SimpleStringData) => {

                    return eventsConsumer.onData({
                        annotation: annotation,
                        type: ["simple string", {
                            value: data.value,
                            wrapping: ((): core.TreeBuilderWrappingType => {
                                switch (data2.wrapping[0]) {
                                    case "apostrophe": {
                                        return ["apostrophe", {
                                        }]
                                    }
                                    case "none": {
                                        return ["none", {
                                        }]
                                    }
                                    case "quote": {
                                        return ["quote", {
                                        }]
                                    }
                                    default:
                                        return assertUnreachable(data2.wrapping[0])
                                }
                            })(),
                        }],
                    })
                }
                switch (currentContext.type[0]) {
                    case StackContextType2.ARRAY: {
                        return sendStringValue(data)
                    }
                    case StackContextType2.OBJECT: {
                        const $$ = currentContext.type[1]

                        switch ($$.state) {
                            case ObjectState.EXPECTING_KEY:
                                $$.state = ObjectState.EXPECTING_OBJECT_VALUE

                                return sendStringValue(data)

                            case ObjectState.EXPECTING_OBJECT_VALUE:

                                $$.state = ObjectState.EXPECTING_KEY
                                return sendStringValue(data)

                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    case StackContextType2.TAGGED_UNION: {
                        const $$ = currentContext.type[1]

                        switch ($$.state) {
                            case TaggedUnionState.EXPECTING_OPTION:
                                $$.state = TaggedUnionState.EXPECTING_VALUE
                                return sendStringValue(data)
                            case TaggedUnionState.EXPECTING_VALUE: {

                                return sendStringValue(data).mapResult(() => {
                                    return this.popContext(annotation, onStackEmpty)
                                })
                            }
                            default:
                                return assertUnreachable($$.state)
                        }
                    }
                    default:
                        return assertUnreachable(currentContext.type[0])
                }
            }

        }
        private onPunctuation(annotation: Annotation, data: PunctionationData, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            const curChar = data.char
            switch (curChar) {
                case Char.Punctuation.exclamationMark:
                    raiseError(["unexpected '!'"], annotation)
                    return p.value(false)
                case Char.Punctuation.closeAngleBracket:
                    return this.onArrayClose(">", annotation, onStackEmpty)
                case Char.Punctuation.closeBracket:
                    return this.onArrayClose("]", annotation, onStackEmpty)
                case Char.Punctuation.comma:
                    //TODO add as annotation to next token
                    return p.value(false)
                case Char.Punctuation.openAngleBracket:
                    return this.onArrayOpen("<", annotation)
                case Char.Punctuation.openBracket:
                    return this.onArrayOpen("[", annotation)
                case Char.Punctuation.closeBrace:
                    return this.onObjectClose("}", annotation, onStackEmpty)
                case Char.Punctuation.closeParen:
                    return this.onObjectClose(")", annotation, onStackEmpty)
                case Char.Punctuation.colon:
                    //TODO add as annotation to next token
                    return p.value(false)
                case Char.Punctuation.openBrace:
                    return this.onObjectOpen("{", annotation)
                case Char.Punctuation.openParen:
                    return this.onObjectOpen("(", annotation)
                case Char.Punctuation.verticalLine:
                    return this.onTaggedUnion(annotation)

                default:
                    raiseError(
                        ['unknown punctuation', {
                            found: String.fromCharCode(curChar),
                        }],
                        annotation
                    )
                    return p.value(false)
            }
        }
        private onTaggedUnion(annotation: Annotation) {

            const taggedUnion = { state: TaggedUnionState.EXPECTING_OPTION }
            return this.onComplexValue(annotation).mapResult(() => {
                this.pushContext({ annotation: annotation, type: [StackContextType2.TAGGED_UNION, taggedUnion] })
                return eventsConsumer.onData({
                    annotation: annotation,
                    type: ["tagged union", {
                    }],
                })

            })
        }
        private onObjectOpen(openCharacter: "(" | "{", annotation: Annotation): p.IValue<boolean> {
            return this.onComplexValue(annotation).mapResult(() => {
                this.pushContext({
                    annotation: annotation,
                    type: [StackContextType2.OBJECT, {
                        state: ObjectState.EXPECTING_KEY,
                        //openChar: curChar,
                        type: openCharacter === "(" ? ["verbose type"] : ["dictionary", {}],
                    }],
                })
                return eventsConsumer.onData({
                    annotation: annotation,
                    type: ["open object", {
                        type: openCharacter === "(" ? ["verbose type"] : ["dictionary"],
                    }],
                })

            })
        }
        private onObjectClose(closeCharacter: ")" | "}", annotation: Annotation, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            return eventsConsumer.onData({
                annotation: annotation,
                type: ["close object", {}],
            }).mapResult(() => {
                if (currentContext === null || currentContext.type[0] !== StackContextType2.OBJECT) {
                    raiseError(["not in an object"], annotation)
                    return p.value(false)
                } else {
                    const $ = currentContext.type[1]
                    if ($.state === ObjectState.EXPECTING_OBJECT_VALUE) {
                        raiseError(["missing property value"], annotation)
                    }
                    switch ($.type[0]) {
                        case "dictionary": {
                            if (closeCharacter !== "}") {
                                raiseError(["invalid dictionary close"], annotation)
                            }
                            break
                        }
                        case "verbose type": {
                            if (closeCharacter !== ")") {
                                raiseError(["invalid verbose type close"], annotation)
                            }
                            break
                        }
                        default:
                            assertUnreachable($.type[0])
                    }
                    return this.popContext(annotation, onEndOfStack)
                }
            })
        }
        private onArrayOpen(openCharacter: "[" | "<", annotation: Annotation) {
            return this.onComplexValue(annotation).mapResult(() => {
                this.pushContext({
                    annotation: annotation,
                    type: [StackContextType2.ARRAY, {
                        type: openCharacter === "<" ? ["shorthand type"] : ["list", {}],
                    }],
                })
                return eventsConsumer.onData({
                    annotation: annotation,
                    type: ["open array", {
                        type: openCharacter === "<" ? ["shorthand type"] : ["list"],

                    }],
                })

            })
        }
        private onArrayClose(
            closeCharacter: "]" | ">",
            annotation: Annotation,
            onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>,
        ) {
            return eventsConsumer.onData({
                annotation: annotation,
                type: ["close array", {}],
            }).mapResult(() => {
                if (currentContext === null || currentContext.type[0] !== StackContextType2.ARRAY) {
                    raiseError(["not in an array"], annotation)
                    return p.value(false)
                } else {
                    const $ = currentContext.type[1]
                    switch ($.type[0]) {
                        case "list": {
                            if (closeCharacter !== "]") {
                                raiseError(["invalid list close"], annotation)
                            }
                            break
                        }
                        case "shorthand type": {
                            if (closeCharacter !== ">") {
                                raiseError(["invalid shorthand type close"], annotation)
                            }
                            break
                        }
                        default:
                            assertUnreachable($.type[0])
                    }
                    return this.popContext(annotation, onEndOfStack)
                }
            })
        }
        private onComplexValue(annotation: Annotation): p.IValue<boolean> {
            if (currentContext === null) {
                //the beginning of the content
                return p.value(false)
            }
            switch (currentContext.type[0]) {
                case StackContextType2.ARRAY: {
                    return p.value(false)
                }
                case StackContextType2.OBJECT: {
                    const $$ = currentContext.type[1]
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
                    const $$ = currentContext.type[1]
                    switch ($$.state) {
                        case TaggedUnionState.EXPECTING_OPTION:
                            raiseError(["expected option"], annotation)
                            return p.value(false)
                        case TaggedUnionState.EXPECTING_VALUE: {
                            return p.value(false)
                        }
                        default:
                            return assertUnreachable($$.state)
                    }
                }
                default:
                    return assertUnreachable(currentContext.type[0])
            }

        }
    }
    return new TreeParser()
}
