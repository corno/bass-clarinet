/* eslint
    camelcase:"off",
    complexity:"off",
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import { Location, Range, getEndLocationFromRange, createRangeFromSingleLocation } from "../../location"
import {
    TreeEventType,
    ITreeParserEventConsumer,
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
import { ParserAnnotationData, StringValueDataType } from "../../interfaces"

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

type StackContext = {
    range: Range
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

export function createTreeParser<ReturnType, ErrorType>(
    onerror: (error: TreeParserError, range: Range) => void,
    eventsConsumer: ITreeParserEventConsumer<ParserAnnotationData, ReturnType, ErrorType>
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

    function raiseError(message: TreeParserErrorType, range: Range) {
        //if (DEBUG) { console.log("error raised:", message, printRange(range)) }
        onerror(
            {
                type: message,
            },
            range
        )
    }
    const stack = new Array<StackContext>()
    let currentContext: StackContext | null = null


    function reportUnexpectedStackContext(stackContext: StackContext, location: Location) {
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


    function createAnnotation(tokenString: string, range: Range): ParserAnnotationData {
        return {
            tokenString: tokenString,
            indentation: indentationState.getIndentation(),
            range: range,
            contextData: {
                before: {
                    comments: [],
                },
                lineCommentAfter: null,
            },

        }
    }
    function createEndAnnotation(location: Location): ParserAnnotationData {
        return {
            tokenString: "",
            indentation: indentationState.getIndentation(),
            range: createRangeFromSingleLocation(location),
            contextData: {
                before: {
                    comments: [],
                },
                lineCommentAfter: null,
            },

        }
    }

    class TreeParser {
        public forceEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> {
            if (!aborted) {
                if (currentContext !== null) {
                    reportUnexpectedStackContext(currentContext, location)
                }
                currentContext = null
                while (true) {
                    const popped = stack.pop()
                    if (popped === undefined) {
                        break
                    } else {
                        reportUnexpectedStackContext(popped, location)
                    }
                }
            }
            return eventsConsumer.onEnd(aborted, createEndAnnotation(location))
        }
        public pushContext(context: StackContext): void {
            //if (DEBUG) console.log(`pushed context ${this.getCurrentContext().getDescription()}>${context.getDescription()}`)
            if (currentContext !== null) {
                stack.push(currentContext)
            }
            currentContext = context
        }
        public popContext(range: Range, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            const popped = stack.pop()
            if (popped === undefined) {
                return onStackEmpty(eventsConsumer.onEnd(false, createEndAnnotation(getEndLocationFromRange(range))))
            } else {
                //if (DEBUG) console.log(`popped context ${popped.getDescription()}<${this.getCurrentContext().getDescription()}`)
                currentContext = popped

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
                    return p.value(false)
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


            if (currentContext === null) {
                return onStackEmpty(eventsConsumer.onEnd(false, createAnnotation(tokenString, range)))
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

                    return eventsConsumer.onData({
                        annotation: createAnnotation(tokenString, range),
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
                switch (currentContext.type[0]) {
                    case StackContextType2.ARRAY: {
                        return sendStringValue(data)
                    }
                    case StackContextType2.OBJECT: {
                        const $$ = currentContext.type[1]

                        switch ($$.state) {
                            case ObjectState.EXPECTING_KEY:
                                $$.state = ObjectState.EXPECTING_OBJECT_VALUE

                                return eventsConsumer.onData({
                                    annotation: createAnnotation(tokenString, range),
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
                        const $$ = currentContext.type[1]

                        switch ($$.state) {
                            case TaggedUnionState.EXPECTING_OPTION:
                                $$.state = TaggedUnionState.EXPECTING_VALUE

                                return eventsConsumer.onData({
                                    annotation: createAnnotation(tokenString, range),
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
                        return assertUnreachable(currentContext.type[0])
                }
            }

        }
        private onPunctuation(range: Range, tokenString: string, data: PunctionationData, onStackEmpty: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            const curChar = data.char
            switch (curChar) {
                case Char.Punctuation.exclamationMark:
                    raiseError(["unexpected '!'"], range)
                    return p.value(false)
                case Char.Punctuation.closeAngleBracket:
                    return this.onArrayClose(">", range, onStackEmpty)
                case Char.Punctuation.closeBracket:
                    return this.onArrayClose("]", range, onStackEmpty)
                case Char.Punctuation.comma:
                    //TODO add as annotation to next token
                    return p.value(false)
                case Char.Punctuation.openAngleBracket:
                    return this.onArrayOpen("<", range)
                case Char.Punctuation.openBracket:
                    return this.onArrayOpen("[", range)
                case Char.Punctuation.closeBrace:
                    return this.onObjectClose("}", range, onStackEmpty)
                case Char.Punctuation.closeParen:
                    return this.onObjectClose(")", range, onStackEmpty)
                case Char.Punctuation.colon:
                    //TODO add as annotation to next token
                    return p.value(false)
                case Char.Punctuation.openBrace:
                    return this.onObjectOpen("{", range)
                case Char.Punctuation.openParen:
                    return this.onObjectOpen("(", range)
                case Char.Punctuation.verticalLine:
                    return this.onTaggedUnion(range)

                default:
                    raiseError(
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
                return eventsConsumer.onData({
                    annotation: createAnnotation("|", range),
                    type: [TreeEventType.TaggedUnion, {
                    }],
                })

            })
        }
        private onObjectOpen(openCharacter: "(" | "{", range: Range): p.IValue<boolean> {
            return this.onComplexValue(range).mapResult(() => {
                this.pushContext({
                    range: range, type: [StackContextType2.OBJECT, {
                        state: ObjectState.EXPECTING_KEY,
                        //openChar: curChar,
                        type: openCharacter === "(" ? ["verbose type"] : ["dictionary", {}],
                    }],
                })
                return eventsConsumer.onData({
                    annotation: createAnnotation(openCharacter, range),
                    type: [TreeEventType.OpenObject, {
                        type: openCharacter === "(" ? ["verbose type"] : ["dictionary"],
                    }],
                })

            })
        }
        private onObjectClose(closeCharacter: ")" | "}", range: Range, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>): p.IValue<boolean> {
            return eventsConsumer.onData({
                annotation: createAnnotation(closeCharacter, range),
                type: [TreeEventType.CloseObject],
            }).mapResult(() => {
                if (currentContext === null || currentContext.type[0] !== StackContextType2.OBJECT) {
                    raiseError(["not in an object"], range)
                    return p.value(false)
                } else {
                    const $ = currentContext.type[1]
                    if ($.state === ObjectState.EXPECTING_OBJECT_VALUE) {
                        raiseError(["missing property value"], range)
                    }
                    switch ($.type[0]) {
                        case "dictionary": {
                            if (closeCharacter !== "}") {
                                raiseError(["invalid dictionary close"], range)
                            }
                            break
                        }
                        case "verbose type": {
                            if (closeCharacter !== ")") {
                                raiseError(["invalid verbose type close"], range)
                            }
                            break
                        }
                        default:
                            assertUnreachable($.type[0])
                    }
                    return this.popContext(range, onEndOfStack)
                }
            })
        }
        private onArrayOpen(openCharacter: "[" | "<", range: Range) {
            return this.onComplexValue(range).mapResult(() => {
                this.pushContext({
                    range: range, type: [StackContextType2.ARRAY, {
                        type: openCharacter === "<" ? ["shorthand type"] : ["list", {}],
                    }],
                })
                return eventsConsumer.onData({
                    annotation: createAnnotation(openCharacter, range),
                    type: [TreeEventType.OpenArray, {
                        type: openCharacter === "<" ? ["shorthand type"] : ["list"],

                    }],
                })

            })
        }
        private onArrayClose(closeCharacter: "]" | ">", range: Range, onEndOfStack: (result: p.IUnsafeValue<ReturnType, ErrorType>) => p.IValue<boolean>) {

            return eventsConsumer.onData({
                annotation: createAnnotation(closeCharacter, range),
                type: [TreeEventType.CloseArray],
            }).mapResult(() => {
                if (currentContext === null || currentContext.type[0] !== StackContextType2.ARRAY) {
                    raiseError(["not in an array"], range)
                    return p.value(false)
                } else {
                    const $ = currentContext.type[1]
                    switch ($.type[0]) {
                        case "list": {
                            if (closeCharacter !== "]") {
                                raiseError(["invalid list close"], range)
                            }
                            break
                        }
                        case "shorthand type": {
                            if (closeCharacter !== ">") {
                                raiseError(["invalid shorthand type close"], range)
                            }
                            break
                        }
                        default:
                            assertUnreachable($.type[0])
                    }
                    return this.popContext(range, onEndOfStack)
                }
            })
        }
        private onComplexValue(range: Range): p.IValue<boolean> {
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
                            raiseError(["expected option"], range)
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
