/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
    complexity: off,
    max-classes-per-file: off,
*/
import * as p from "pareto"
import {
    createRangeFromSingleLocation,
    Location,
    OverheadTokenType,
    Range,
    TextParserEventConsumer,
    TreeEvent,
    TreeEventType,
} from "../parser"
import { createDummyValueHandler } from "./dummyHandlers"
import {
    RequiredValueHandler,
    ObjectHandler,
    ArrayHandler,
    TaggedUnionHandler,
    ValueHandler,
    StringType2,
    StackContext,
} from "../handlers"
import { RangeError } from "../errors"

const DEBUG = false


export type BeforeContextData = {
    comments: Comment[]
    indentation: string | null
}

export type ContextData = {
    before: BeforeContextData
    lineCommentAfter: null | Comment
}

export type ParserAnnotationData = {
    tokenString: string
    contextData: ContextData
    range: Range
}

export type ParserRequiredValueHandler = RequiredValueHandler<ParserAnnotationData, null>
export type ParserValueHandler = ValueHandler<ParserAnnotationData, null>
export type ParserObjectHandler = ObjectHandler<ParserAnnotationData, null>
export type ParserTaggedUnionHandler = TaggedUnionHandler<ParserAnnotationData, null>
export type ParserArrayHandler = ArrayHandler<ParserAnnotationData, null>

export type Comment = {
    text: string
    outerRange: Range
    innerRange: Range
    type:
    | "block"
    | "line"
    indent: null | string
}


class StackedDataSubscriberPanic extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

type TaggedUnionState =
    | ["expecting option", {
    }]
    | ["expecting value", ParserRequiredValueHandler]


type ContextType =
    | ["object", {
        type:
        | ["dictionary"]
        | ["verbose type"]
        readonly objectHandler: ParserObjectHandler
        propertyHandler: null | ParserRequiredValueHandler
        foundProperties: boolean
    }]
    | ["array", {
        type:
        | ["list"]
        | ["shorthand type"]
        foundElements: boolean
        readonly arrayHandler: ParserArrayHandler
    }]
    | ["taggedunion", {
        readonly handler: ParserTaggedUnionHandler
        state: TaggedUnionState
    }]

export type StackedDataError =
    | ["unexpected end of document", {
        "still in":
        | ["array"]
        | ["object"]
        | ["tagged union"]
    }]
    | ["missing property data"]
    | ["unmatched dictionary close"]
    | ["unmatched verbose type close"]

    | ["unmatched list close"]
    | ["unmatched shorthand type close"]
    | ["missing object close"]
    | ["missing array close"]
    | ["missing tagged union value"]
    | ["missing tagged union option and value"]
    | ["unexpected end of array"]
    | ["unexpected end of object"]
    | ["unexpected key"]

export function printStackedDataError(error: StackedDataError): string {
    switch (error[0]) {
        case "unmatched dictionary close": {
            return error[0]
        }
        case "unmatched verbose type close": {
            return error[0]
        }
        case "unmatched list close": {
            return error[0]
        }
        case "unmatched shorthand type close": {
            return error[0]
        }
        case "missing array close": {
            return error[0]
        }
        case "missing object close": {
            return error[0]
        }
        case "missing property data": {
            return error[0]
        }
        case "missing tagged union option and value": {
            return error[0]
        }
        case "missing tagged union value": {
            return error[0]
        }
        case "unexpected end of array": {
            return error[0]
        }
        case "unexpected end of document": {
            const $ = error[1]
            return `unexpected end of document, still in ${$["still in"][0]}`
        }
        case "unexpected end of object": {
            return error[0]
        }
        case "unexpected key": {
            return error[0]
        }
        default:
            return assertUnreachable(error[0])
    }
}

function raiseError(onError: (error: StackedDataError, range: Range) => void, error: StackedDataError, range: Range) {
    onError(error, range)
}

class OverheadState {
    private comments: Comment[] = []
    private indentation = ""
    private lineIsDirty = false
    flush(): BeforeContextData {
        const bcd: BeforeContextData = {
            comments: this.comments,
            indentation: this.indentation,
        }
        this.comments = []
        this.lineIsDirty = false
        return bcd
    }
    setLineDirty() {
        this.lineIsDirty = true
    }
    onCommend(comment: Comment) {
        this.comments.push(comment)
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


class SemanticState {
    currentContext: ContextType | null = null
    private readonly stack: (ContextType | null)[] = []
    private dictionaryDepth = 0
    private verboseTypeDepth = 0
    private listDepth = 0
    private shorthandTypeDepth = 0
    private taggedUnionDepth = 0
    public rootValueHandler: ParserRequiredValueHandler | null //becomes null when processed

    constructor(valueHandler: ParserRequiredValueHandler) {
        this.rootValueHandler = valueHandler
    }
    public createStackContext(): StackContext {
        return {
            dictionaryDepth: this.dictionaryDepth,
            verboseTypeDepth: this.verboseTypeDepth,
            listDepth: this.listDepth,
            shorthandTypeDepth: this.shorthandTypeDepth,
            taggedUnionDepth: this.taggedUnionDepth,
        }
    }
    public pop(range: Range) {

        if (this.currentContext === null) {
            throw new StackedDataSubscriberPanic("unexpected end of stack", range)
        }
        switch (this.currentContext[0]) {
            case "array": {
                const $ = this.currentContext[1]
                switch ($.type[0]) {
                    case "list": {
                        this.listDepth -= 1
                        break
                    }
                    case "shorthand type": {
                        this.shorthandTypeDepth -= 1
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case "object": {
                const $ = this.currentContext[1]
                switch ($.type[0]) {
                    case "dictionary": {
                        this.dictionaryDepth -= 1
                        break
                    }
                    case "verbose type": {
                        this.verboseTypeDepth -= 1
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case "taggedunion": {
                this.taggedUnionDepth -= 1
                break
            }
            default:
                assertUnreachable(this.currentContext[0])
        }
        const previousContext = this.stack.pop()
        if (previousContext === undefined) {
            throw new StackedDataSubscriberPanic("unexpected end of stack", range)
        } else {
            if (previousContext !== null && previousContext[0] === "taggedunion") {
                const taggedUnion = previousContext[1]
                if (taggedUnion.state[0] !== "expecting value") {
                    throw new StackedDataSubscriberPanic("unexpected tagged union state", range)
                }
                taggedUnion.handler.end({
                    annotation: null,
                })
            }
            this.currentContext = previousContext
        }
    }
    public push(newContext: ContextType) {
        this.stack.push(this.currentContext)
        this.currentContext = newContext
        switch (newContext[0]) {
            case "array": {
                const $ = newContext[1]
                switch ($.type[0]) {
                    case "list": {
                        this.listDepth += 1
                        break
                    }
                    case "shorthand type": {
                        this.shorthandTypeDepth += 1
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case "object": {
                const $ = newContext[1]
                switch ($.type[0]) {
                    case "dictionary": {
                        this.dictionaryDepth += 1
                        break
                    }
                    case "verbose type": {
                        this.verboseTypeDepth += 1
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case "taggedunion": {
                this.taggedUnionDepth += 1
                break
            }
            default:
                assertUnreachable(newContext[0])
        }
    }
    public wrapupValue(range: Range): void {
        if (this.currentContext === null) {
            this.rootValueHandler = null
        } else {
            switch (this.currentContext[0]) {
                case "array": {
                    break
                }
                case "object": {
                    this.currentContext[1].propertyHandler = null
                    break
                }
                case "taggedunion": {
                    if (this.currentContext[1].state[0] !== "expecting value") {
                        //error is already reported by parser
                    } else {
                        this.pop(range)
                        this.wrapupValue(range)
                    }
                    break
                }
                default:
                    return assertUnreachable(this.currentContext[0])
            }
        }
    }
    public initValueHandler(): ParserValueHandler {
        if (this.currentContext === null) {
            const vh = this.rootValueHandler
            if (vh === null) {
                //expected end of document
                //error is already reported by parser
                return createDummyValueHandler()

            }
            return vh.exists
        } else {
            switch (this.currentContext[0]) {
                case "array": {
                    const $ = this.currentContext[1]
                    const isFirst = !$.foundElements
                    $.foundElements = true
                    return this.currentContext[1].arrayHandler.element({
                        data: {
                            isFirst: isFirst,
                        },
                        stackContext: this.createStackContext(),
                        annotation: null,
                    })
                }
                case "object": {
                    if (this.currentContext[1].propertyHandler === null) {
                        //expected a key or end of the object
                        //error is already reported by parser
                        return createDummyValueHandler()
                    } else {
                        return this.currentContext[1].propertyHandler.exists
                    }
                }
                case "taggedunion": {
                    if (this.currentContext[1].state[0] !== "expecting value") {
                        //error is already reported by parser
                        return createDummyValueHandler()
                    } else {
                        return this.currentContext[1].state[1].exists
                    }
                }
                default:
                    return assertUnreachable(this.currentContext[0])
            }
        }
    }
}
type EventData = {
    beforeContextData: BeforeContextData
    handler: (contextData: ContextData) => p.IValue<boolean>
}

type ProcessResult =
    | ["event", EventData]
    | ["whitespace", {
        value: string
    }]
    | ["comment", {
        comment: Comment
    }]
    | ["other"]
    | ["newline"]


function processParserEvent(
    data: TreeEvent,
    semanticState: SemanticState,
    overheadState: OverheadState,
    onError: (error: StackedDataError, range: Range) => void,
): ProcessResult {


    switch (data.type[0]) {
        case TreeEventType.CloseArray: {
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    unwindLoop: while (true) {
                        if (semanticState.currentContext === null) {
                            break unwindLoop
                        }
                        switch (semanticState.currentContext[0]) {
                            case "array": {
                                break unwindLoop
                                //break
                            }
                            case "object": {
                                const $$2 = semanticState.currentContext[1]
                                if ($$2.propertyHandler !== null) {
                                    raiseError(onError, ["missing property data"], data.range)
                                    $$2.propertyHandler.missing()
                                    $$2.propertyHandler = null
                                }
                                raiseError(onError, ["missing object close"], data.range)
                                semanticState.pop(data.range)
                                semanticState.wrapupValue(data.range)
                                break
                            }
                            case "taggedunion": {
                                //const $ = state.currentContext[1]
                                if (semanticState.currentContext[1].state[0] === "expecting value") {
                                    semanticState.currentContext[1].state[1].missing()
                                    raiseError(onError, ["missing tagged union value"], data.range)
                                } else {
                                    raiseError(onError, ["missing tagged union option and value"], data.range)
                                }
                                semanticState.pop(data.range)
                                semanticState.wrapupValue(data.range)
                                break
                            }
                            default:
                                assertUnreachable(semanticState.currentContext[0])
                        }
                    }
                    if (semanticState.currentContext === null || semanticState.currentContext[0] !== "array") {
                        raiseError(onError, ["unexpected end of array"], data.range)
                        return p.value(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        switch ($$.type[0]) {
                            case "list": {
                                if (data.tokenString !== "]") {
                                    raiseError(onError, ["unmatched list close"], data.range)

                                }
                                break
                            }
                            case "shorthand type": {
                                if (data.tokenString !== ">") {
                                    raiseError(onError, ["unmatched shorthand type close"], data.range)

                                }

                                break
                            }
                            default:
                                assertUnreachable($$.type[0])
                        }
                        $$.arrayHandler.arrayEnd({
                            annotation: {
                                tokenString: data.tokenString,
                                range: data.range,
                                contextData: contextData,
                            },
                            stackContext: semanticState.createStackContext(),
                        })
                        semanticState.pop(data.range)
                        semanticState.wrapupValue(data.range)
                        return p.value(false)
                    }
                },
            }]
        }
        case TreeEventType.CloseObject: {
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    unwindLoop: while (true) {
                        if (semanticState.currentContext === null) {
                            break unwindLoop
                        }
                        switch (semanticState.currentContext[0]) {
                            case "array": {
                                //const $ = state.currentContext[1]
                                raiseError(onError, ["missing array close"], data.range)
                                semanticState.pop(data.range)
                                semanticState.wrapupValue(data.range)
                                break
                            }
                            case "object": {
                                break unwindLoop
                                break
                            }
                            case "taggedunion": {
                                //const $ = state.currentContext[1]
                                if (semanticState.currentContext[1].state[0] === "expecting value") {
                                    semanticState.currentContext[1].state[1].missing()
                                    raiseError(onError, ["missing tagged union value"], data.range)
                                } else {
                                    raiseError(onError, ["missing tagged union option and value"], data.range)
                                }
                                semanticState.pop(data.range)
                                semanticState.wrapupValue(data.range)
                                break
                            }
                            default:
                                assertUnreachable(semanticState.currentContext[0])
                        }
                    }
                    if (semanticState.currentContext === null || semanticState.currentContext[0] !== "object") {
                        raiseError(onError, ["unexpected end of object"], data.range)
                        return p.value(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        switch ($$.type[0]) {
                            case "dictionary": {
                                if (data.tokenString !== "}") {
                                    raiseError(onError, ["unmatched dictionary close"], data.range)

                                }
                                break
                            }
                            case "verbose type": {
                                if (data.tokenString !== ")") {
                                    raiseError(onError, ["unmatched verbose type close"], data.range)

                                }

                                break
                            }
                            default:
                                assertUnreachable($$.type[0])
                        }
                        if ($$.propertyHandler !== null) {
                            //was in the middle of processing a property
                            //the key was parsed, but the data was not
                            $$.propertyHandler.missing()
                            $$.propertyHandler = null
                        }
                        $$.objectHandler.objectEnd({
                            annotation: {
                                tokenString: data.tokenString,
                                range: data.range,
                                contextData: contextData,
                            },
                            stackContext: semanticState.createStackContext(),
                        })
                        semanticState.pop(data.range)
                        semanticState.wrapupValue(data.range)
                        return p.value(false)
                    }

                },
            }]
        }
        case TreeEventType.Colon: {
            return ["other"]
        }
        case TreeEventType.Comma: {
            return ["other"]
        }
        case TreeEventType.OpenArray: {
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    const arrayHandler = semanticState.initValueHandler().array({
                        data: {
                            type: data.tokenString === "<" ? ["shorthand type"] : ["list"],
                        },
                        annotation: {
                            tokenString: data.tokenString,
                            range: data.range,
                            contextData: contextData,
                        },
                        stackContext: semanticState.createStackContext(),
                    })
                    semanticState.push(["array", {
                        foundElements: false,
                        type: data.tokenString === "<" ? ["shorthand type"] : ["list"],
                        arrayHandler: arrayHandler,
                    }])
                    return p.value(false)
                },
            }]
        }
        case TreeEventType.OpenObject: {
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    const vh = semanticState.initValueHandler()

                    const objectHandler = vh.object({
                        data: {
                            type: data.tokenString === "(" ? ["verbose type"] : ["dictionary"],
                        },
                        annotation: {
                            tokenString: data.tokenString,
                            range: data.range,
                            contextData: contextData,
                        },
                        stackContext: semanticState.createStackContext(),
                    })
                    semanticState.push(["object", {
                        foundProperties: false,
                        type: data.tokenString === "(" ? ["verbose type"] : ["dictionary"],
                        objectHandler: objectHandler,
                        propertyHandler: null,
                    }])
                    return p.value(false)
                },
            }]
        }
        case TreeEventType.Overhead: {
            const $ = data.type[1]
            switch ($.type[0]) {
                case OverheadTokenType.Comment: {
                    const $$ = $.type[1]
                    return ["comment", {
                        comment: {
                            text: $$.comment,
                            type: $$.type,
                            indent: null, //FIX get the right indent info
                            outerRange: data.range,
                            innerRange: $$.innerRange,
                        },
                    }]
                }
                case OverheadTokenType.NewLine: {
                    return ["newline"]
                }
                case OverheadTokenType.WhiteSpace: {
                    return ["whitespace", {
                        value: data.tokenString,
                    }]
                }
                default:
                    return assertUnreachable($.type[0])
            }
        }

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
        case TreeEventType.String: {
            const $ = data.type[1]

            const valueAsString = ((): string => {
                switch ($.type[0]) {
                    case "quoted": {
                        const $$ = $.type[1]
                        return $$.value
                    }
                    case "apostrophed": {
                        const $$ = $.type[1]
                        return $$.value
                    }
                    case "multiline": {
                        const $$ = $.type[1]
                        return trimStringLines($$.lines, overheadState.getIndentation()).join("\n")
                    }
                    case "nonwrapped": {
                        const $$ = $.type[1]
                        return $$.value
                    }
                    default:
                        return assertUnreachable($.type[0])
                }
            })()
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {

                    function onString(vh: ParserValueHandler, cd: ContextData): p.IValue<boolean> {
                        //if (DEBUG) { console.log("on string", $.value) }
                        semanticState.wrapupValue(data.range)
                        return vh.string({
                            data: {
                                type: ((): StringType2 => {
                                    switch ($.type[0]) {
                                        case "quoted": {
                                            const $$ = $.type[1]
                                            return ["quoted", {
                                                value: $$.value,
                                            }]
                                        }
                                        case "apostrophed": {
                                            const $$ = $.type[1]
                                            //strings with apostrophes are not canonical
                                            return ["quoted", {
                                                value: $$.value,
                                            }]
                                        }
                                        case "multiline": {
                                            const $$ = $.type[1]

                                            return ["multiline", {
                                                lines: trimStringLines($$.lines, overheadState.getIndentation()),
                                            }]
                                        }
                                        case "nonwrapped": {
                                            const $$ = $.type[1]
                                            return ["nonwrapped", {
                                                value: $$.value,
                                            }]
                                        }
                                        default:
                                            return assertUnreachable($.type[0])
                                    }
                                })(),
                            },
                            annotation: {
                                tokenString: valueAsString,
                                range: data.range,
                                contextData: cd,
                            },
                            stackContext: semanticState.createStackContext(),

                        })
                    }
                    if (semanticState.currentContext === null) {
                        //handle case when root value was already processed
                        const vh = semanticState.rootValueHandler !== null
                            ? semanticState.rootValueHandler.exists
                            : createDummyValueHandler()
                        return onString(vh, contextData)
                    }
                    switch (semanticState.currentContext[0]) {
                        case "array": {
                            const $ = semanticState.currentContext[1]
                            const isFirst = !$.foundElements
                            $.foundElements = true
                            return onString(
                                $.arrayHandler.element({
                                    data: {
                                        isFirst: isFirst,
                                    },
                                    stackContext: semanticState.createStackContext(),
                                    annotation: null,
                                }),
                                contextData)
                        }
                        case "object": {
                            const $$ = semanticState.currentContext[1]
                            if ($$.propertyHandler === null) {
                                if (semanticState.currentContext[0] !== "object") {
                                    raiseError(onError, ["unexpected key"], data.range)
                                    return p.value(false)
                                } else {
                                    const $$$ = semanticState.currentContext[1]
                                    $$$.foundProperties = true
                                    return $$.objectHandler.property({
                                        data: {
                                            key: valueAsString,
                                        },
                                        annotation: {
                                            tokenString: valueAsString,
                                            range: data.range,
                                            contextData: contextData,
                                        },
                                        stackContext: semanticState.createStackContext(),
                                    }).mapResult(propHandler => {
                                        $$.propertyHandler = propHandler
                                        return p.value(false)
                                    })
                                }
                            } else {
                                const $$$ = $$.propertyHandler
                                return onString($$$.exists, contextData)
                            }
                        }
                        case "taggedunion": {
                            const $$ = semanticState.currentContext[1]
                            switch ($$.state[0]) {
                                case "expecting option": {
                                    //const $$$ = $$.state[1]
                                    if (DEBUG) { console.log("on option", valueAsString) }
                                    $$.state = ["expecting value", $$.handler.option({
                                        data: {
                                            option: valueAsString,
                                        },
                                        annotation: {
                                            tokenString: valueAsString,
                                            range: data.range,
                                            contextData: contextData,
                                        },
                                        stackContext: semanticState.createStackContext(),
                                    })]
                                    return p.value(false)
                                }
                                case "expecting value": {
                                    const $$$ = $$.state[1]
                                    return onString($$$.exists, contextData)
                                }
                                default:
                                    return assertUnreachable($$.state[0])
                            }
                        }
                        default:
                            return assertUnreachable(semanticState.currentContext[0])
                    }
                },
            }]
        }
        case TreeEventType.TaggedUnion: {
            if (DEBUG) { console.log("on open tagged union") }
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    semanticState.push(["taggedunion", {
                        handler: semanticState.initValueHandler().taggedUnion({
                            annotation: {
                                tokenString: data.tokenString,
                                range: data.range,
                                contextData: contextData,
                            },
                            stackContext: semanticState.createStackContext(),
                        }),
                        state: ["expecting option", {
                        }],
                    }])
                    return p.value(false)
                },
            }]
        }
        default:
            return assertUnreachable(data.type[0])
    }
}

/**
 * this function allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */
export function createStackedParser<ReturnType, ErrorType>(
    valueHandler: ParserRequiredValueHandler,
    onError: (error: StackedDataError, range: Range) => void,
    onEnd: () => p.IUnsafeValue<ReturnType, ErrorType>
): TextParserEventConsumer<ReturnType, ErrorType> {
    const overheadState = new OverheadState()
    const semanticState = new SemanticState(valueHandler)

    let cachedEvent: null | EventData = null


    return {
        onData: (data: TreeEvent): p.IValue<boolean> => {
            function flush(
                gqe: EventData,
                lineCommentAfter: Comment | null,
                after: () => p.IValue<boolean>
            ) {
                function flushContextData(before: BeforeContextData): ContextData {
                    const contextData: ContextData = {
                        before: before,
                        lineCommentAfter: lineCommentAfter,
                    }
                    return contextData
                }

                return gqe.handler(flushContextData(gqe.beforeContextData)).mapResult(_abortRequested => {
                    return after()
                })
            }
            function flushPossibleQueuedEvent(after: () => p.IValue<boolean>) {

                if (cachedEvent === null) {
                    return after()
                } else {
                    const res = flush(cachedEvent, null, after)
                    cachedEvent = null
                    return res
                }

            }
            const processedParserEvent = processParserEvent(data, semanticState, overheadState, onError)

            switch (processedParserEvent[0]) {
                case "comment": {
                    const $ = processedParserEvent[1]
                    overheadState.setLineDirty()
                    if ($.comment.type === "line" && cachedEvent !== null) {
                        const res = flush(cachedEvent, $.comment, () => p.value(false))
                        cachedEvent = null
                        return res
                    } else {
                        overheadState.onCommend($.comment)
                        return p.value(false)
                    }
                }
                case "event": {
                    return flushPossibleQueuedEvent(() => {

                        const $ = processedParserEvent[1]
                        cachedEvent = $
                        overheadState.setLineDirty()
                        return p.value(false)

                    })
                }
                case "other": {

                    //const $ = odr[1]
                    overheadState.setLineDirty()

                    return p.value(false)

                }
                case "whitespace": {
                    const $ = processedParserEvent[1]
                    overheadState.onWhitespace($.value)

                    return p.value(false)
                }
                case "newline": {
                    return flushPossibleQueuedEvent(() => {

                        //const $ = odr[1]
                        overheadState.onNewline()
                        return p.value(false)

                    })
                }
                default:
                    return assertUnreachable(processedParserEvent[0])
            }
        },
        onEnd: (aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> => {
            function flushContextData(before: BeforeContextData): ContextData {
                const contextData: ContextData = {
                    before: before,
                    lineCommentAfter: null,
                }
                return contextData
            }
            function onEnd2() {

                const range = createRangeFromSingleLocation(location)
                if (!aborted) {
                    unwindLoop: while (true) {
                        if (semanticState.currentContext === null) {

                            if (semanticState.rootValueHandler !== null) {
                                semanticState.rootValueHandler.missing()
                                semanticState.rootValueHandler = null
                            }
                            break unwindLoop
                        }
                        switch (semanticState.currentContext[0]) {
                            case "array": {
                                raiseError(onError, ["unexpected end of document", { "still in": ["array"] }], range)
                                semanticState.pop(range)
                                semanticState.wrapupValue(range)
                                break
                            }
                            case "object": {
                                const $ = semanticState.currentContext[1]
                                if ($.propertyHandler !== null) {
                                    $.propertyHandler.missing()
                                    $.propertyHandler = null
                                }
                                raiseError(onError, ["unexpected end of document", { "still in": ["object"] }], range)
                                semanticState.pop(range)
                                semanticState.wrapupValue(range)
                                break
                            }
                            case "taggedunion": {
                                const $ = semanticState.currentContext[1]
                                switch ($.state[0]) {
                                    case "expecting option": {
                                        //const $$ = $.state[1]
                                        $.handler.missingOption()
                                        break
                                    }
                                    case "expecting value": {
                                        const $$ = $.state[1]
                                        //option not yet parsed
                                        $$.missing()

                                        break
                                    }
                                    default:
                                        assertUnreachable($.state[0])
                                }
                                raiseError(onError, ["unexpected end of document", { "still in": ["tagged union"] }], range)
                                semanticState.pop(range)
                                semanticState.wrapupValue(range)

                                break
                            }
                            default:
                                assertUnreachable(semanticState.currentContext[0])
                        }
                    }
                }
                return onEnd()
            }
            if (cachedEvent === null) {
                return onEnd2()
            } else {
                const gqe = cachedEvent
                cachedEvent = null
                return gqe.handler(flushContextData(gqe.beforeContextData)).try(_abortRequested => {
                    return onEnd2()
                })
            }
        },
    }
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}