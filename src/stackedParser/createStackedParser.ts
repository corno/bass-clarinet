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
    OnValue,
    ObjectHandler,
    ArrayHandler,
    Comment,
    TaggedUnionHandler,
    ValueHandler,
} from "./handlers"
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
    contextData: ContextData
    range: Range
}


class StackedDataSubscriberPanic extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

type TaggedUnionState =
    | ["expecting option", {
    }]
    | ["expecting value", RequiredValueHandler<ParserAnnotationData>]


type ContextType =
    | ["root", {
        rootValueHandler: RequiredValueHandler<ParserAnnotationData> | null //becomes null when processed
    }]
    | ["object", {
        readonly objectHandler: ObjectHandler<ParserAnnotationData>
        propertyHandler: null | RequiredValueHandler<ParserAnnotationData>
    }]
    | ["array", {
        readonly arrayHandler: ArrayHandler<ParserAnnotationData>
    }]
    | ["taggedunion", {
        readonly handler: TaggedUnionHandler<ParserAnnotationData>
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
    | ["missing object close"]
    | ["missing array close"]
    | ["missing tagged union value"]
    | ["missing tagged union option and value"]
    | ["unexpected end of array"]
    | ["unexpected end of object"]
    | ["unexpected key"]

export function printStackedDataError(error: StackedDataError): string {
    switch (error[0]) {
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
    private indentation: string | null = null
    private lineIsDirty = false
    flush(): BeforeContextData {
        const bcd: BeforeContextData = {
            comments: this.comments,
            indentation: this.indentation,
        }
        this.comments = []
        this.indentation = null
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
        this.indentation = null
        this.lineIsDirty = false
    }
}


class SemanticState {
    currentContext: ContextType
    private readonly stack: ContextType[] = []
    constructor(valueHandler: RequiredValueHandler<ParserAnnotationData>) {
        this.currentContext = ["root", { rootValueHandler: valueHandler }]
    }
    public pop(range: Range) {
        const previousContext = this.stack.pop()
        if (previousContext === undefined) {
            throw new StackedDataSubscriberPanic("unexpected end of stack", range)
        } else {
            if (previousContext[0] === "taggedunion") {
                const taggedUnion = previousContext[1]
                if (taggedUnion.state[0] !== "expecting value") {
                    throw new StackedDataSubscriberPanic("unexpected tagged union state", range)
                }
                taggedUnion.handler.end()
            }
            this.currentContext = previousContext
        }
    }
    public push(newContext: ContextType) {
        this.stack.push(this.currentContext)
        this.currentContext = newContext
    }
    public wrapupValue(range: Range): void {
        switch (this.currentContext[0]) {
            case "array": {
                break
            }
            case "object": {
                this.currentContext[1].propertyHandler = null
                break
            }
            case "root": {
                this.currentContext[1].rootValueHandler = null
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
    public initValueHandler(range: Range): OnValue<ParserAnnotationData> {
        switch (this.currentContext[0]) {
            case "array": {
                return this.currentContext[1].arrayHandler.onData(range)
            }
            case "object": {
                if (this.currentContext[1].propertyHandler === null) {
                    //expected a key or end of the object
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return this.currentContext[1].propertyHandler.onExists
                }
            }
            case "root": {
                const vh = this.currentContext[1].rootValueHandler
                if (vh === null) {
                    //expected end of document
                    //error is already reported by parser
                    return createDummyValueHandler()

                }
                return vh.onExists
            }
            case "taggedunion": {
                if (this.currentContext[1].state[0] !== "expecting value") {
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return this.currentContext[1].state[1].onExists
                }
            }
            default:
                return assertUnreachable(this.currentContext[0])
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
            const $ = data.type[1]
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    unwindLoop: while (true) {
                        switch (semanticState.currentContext[0]) {
                            case "array": {
                                break unwindLoop
                                //break
                            }
                            case "object": {
                                const $$2 = semanticState.currentContext[1]
                                if ($$2.propertyHandler !== null) {
                                    raiseError(onError, ["missing property data"], data.range)
                                    $$2.propertyHandler.onMissing()
                                    $$2.propertyHandler = null
                                }
                                raiseError(onError, ["missing object close"], data.range)
                                semanticState.pop(data.range)
                                semanticState.wrapupValue(data.range)
                                break
                            }
                            case "root": {
                                //const $ = state.currentContext[1]
                                break unwindLoop
                                //break
                            }
                            case "taggedunion": {
                                //const $ = state.currentContext[1]
                                if (semanticState.currentContext[1].state[0] === "expecting value") {
                                    semanticState.currentContext[1].state[1].onMissing()
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
                    if (semanticState.currentContext[0] !== "array") {
                        raiseError(onError, ["unexpected end of array"], data.range)
                        return p.value(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        $$.arrayHandler.onEnd({
                            data: $,
                            annotation: {
                                range: data.range,
                                contextData: contextData,
                            },
                        })
                        semanticState.pop(data.range)
                        semanticState.wrapupValue(data.range)
                        return p.value(false)
                    }
                },
            }]
        }
        case TreeEventType.CloseObject: {
            const $ = data.type[1]
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    unwindLoop: while (true) {
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
                            case "root": {
                                //const $ = state.currentContext[1]

                                break unwindLoop
                                break
                            }
                            case "taggedunion": {
                                //const $ = state.currentContext[1]
                                if (semanticState.currentContext[1].state[0] === "expecting value") {
                                    semanticState.currentContext[1].state[1].onMissing()
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
                    if (semanticState.currentContext[0] !== "object") {
                        raiseError(onError, ["unexpected end of object"], data.range)
                        return p.value(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        if ($$.propertyHandler !== null) {
                            //was in the middle of processing a property
                            //the key was parsed, but the data was not
                            $$.propertyHandler.onMissing()
                            $$.propertyHandler = null
                        }
                        $$.objectHandler.onEnd({
                            data: $,
                            annotation: {
                                range: data.range,
                                contextData: contextData,
                            },
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
            const $ = data.type[1]
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    const arrayHandler = semanticState.initValueHandler(data.range)().array({
                        data: $,
                        annotation: {
                            range: data.range,
                            contextData: contextData,
                        },
                    })
                    semanticState.push(["array", { arrayHandler: arrayHandler }])
                    return p.value(false)
                },
            }]
        }
        case TreeEventType.OpenObject: {
            const $ = data.type[1]
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    const vh = semanticState.initValueHandler(data.range)()

                    const objectHandler = vh.object({
                        data: $,
                        annotation: {
                            range: data.range,
                            contextData: contextData,
                        },
                    })
                    semanticState.push(["object", {
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
                    const $$ = $.type[1]
                    return ["whitespace", {
                        value: $$.value,
                    }]
                }
                default:
                    return assertUnreachable($.type[0])
            }
        }
        case TreeEventType.SimpleValue: {
            const $ = data.type[1]
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {

                    function onSimpleValue(vh: ValueHandler<ParserAnnotationData>, cd: ContextData): p.IValue<boolean> {
                        if (DEBUG) { console.log("on simple value", $.value) }
                        semanticState.wrapupValue(data.range)
                        return vh.simpleValue({
                            data: $,
                            annotation: {
                                range: data.range,
                                contextData: cd,
                            },
                        })
                    }
                    switch (semanticState.currentContext[0]) {
                        case "array": {
                            const $ = semanticState.currentContext[1]
                            return onSimpleValue($.arrayHandler.onData(data.range)(), contextData)
                        }
                        case "object": {
                            const $$ = semanticState.currentContext[1]
                            if ($$.propertyHandler === null) {
                                if (semanticState.currentContext[0] !== "object") {
                                    raiseError(onError, ["unexpected key"], data.range)
                                    return p.value(false)
                                } else {
                                    return $$.objectHandler.onData({
                                        key: $.value,
                                        annotation: {
                                            range: data.range,
                                            contextData: contextData,
                                        },
                                    }).mapResult(propHandler => {
                                        $$.propertyHandler = propHandler
                                        return p.value(false)
                                    })
                                }
                            } else {
                                const $$$ = $$.propertyHandler
                                return onSimpleValue($$$.onExists(), contextData)
                            }
                        }
                        case "root": {
                            const $ = semanticState.currentContext[1]
                            //handle case when root value was already processed
                            const vh = $.rootValueHandler !== null
                                ? $.rootValueHandler.onExists
                                : createDummyValueHandler()
                            return onSimpleValue(vh(), contextData)
                        }
                        case "taggedunion": {
                            const $$ = semanticState.currentContext[1]
                            switch ($$.state[0]) {
                                case "expecting option": {
                                    //const $$$ = $$.state[1]
                                    if (DEBUG) { console.log("on option", $.value) }
                                    $$.state = ["expecting value", $$.handler.option({
                                        option: $.value,
                                        annotation: {
                                            range: data.range,
                                            contextData: contextData,
                                        },
                                    })]
                                    return p.value(false)
                                }
                                case "expecting value": {
                                    const $$$ = $$.state[1]
                                    return onSimpleValue($$$.onExists(), contextData)
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
                        handler: semanticState.initValueHandler(data.range)().taggedUnion({
                            range: data.range,
                            annotation: {
                                range: data.range,
                                contextData: contextData,
                            },
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
    valueHandler: RequiredValueHandler<ParserAnnotationData>,
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
                        switch (semanticState.currentContext[0]) {
                            case "root": {
                                const $ = semanticState.currentContext[1]
                                if ($.rootValueHandler !== null) {
                                    $.rootValueHandler.onMissing()
                                    $.rootValueHandler = null
                                }
                                break unwindLoop
                            }
                            case "array": {
                                raiseError(onError, ["unexpected end of document", { "still in": ["array"] }], range)
                                semanticState.pop(range)
                                semanticState.wrapupValue(range)
                                break
                            }
                            case "object": {
                                const $ = semanticState.currentContext[1]
                                if ($.propertyHandler !== null) {
                                    $.propertyHandler.onMissing()
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
                                        $$.onMissing()

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