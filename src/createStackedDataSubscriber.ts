/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
    complexity: off,
    max-classes-per-file: off,
*/
import * as p from "pareto"
import { BodyEventType, BodyEvent } from "./BodyEvent"
import { Location, Range, createRangeFromSingleLocation } from "./location"
import { createDummyValueHandler as createDummyOnValue } from "./dummyHandlers"
import {
    RequiredValueHandler,
    OnValue,
    ObjectHandler,
    ArrayHandler,
    Comment,
    ContextData,
    TaggedUnionHandler,
    ValueHandler,
    BeforeContextData,
} from "./handlers"
import { RangeError } from "./errors"
import { ParserEventConsumer } from "./createParser"
import { OverheadTokenType } from "./Token"

const DEBUG = false

class StackedDataSubscriberPanic extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

type TaggedUnionState =
    | ["expecting option", {
    }]
    | ["expecting value", RequiredValueHandler]


type ContextType =
    | ["root", {
        rootValueHandler: RequiredValueHandler | null //becomes null when processed
    }]
    | ["object", {
        readonly objectHandler: ObjectHandler
        propertyHandler: null | RequiredValueHandler
    }]
    | ["array", {
        readonly arrayHandler: ArrayHandler
    }]
    | ["taggedunion", {
        readonly handler: TaggedUnionHandler
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
    constructor(valueHandler: RequiredValueHandler) {
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
    public initValueHandler(): OnValue {
        switch (this.currentContext[0]) {
            case "array": {
                return this.currentContext[1].arrayHandler.element()
            }
            case "object": {
                if (this.currentContext[1].propertyHandler === null) {
                    //expected a key or end of the object
                    //error is already reported by parser
                    return createDummyOnValue()
                } else {
                    return this.currentContext[1].propertyHandler.onValue
                }
            }
            case "root": {
                const vh = this.currentContext[1].rootValueHandler
                if (vh === null) {
                    //expected end of document
                    //error is already reported by parser
                    return createDummyOnValue()

                }
                return vh.onValue
            }
            case "taggedunion": {
                if (this.currentContext[1].state[0] !== "expecting value") {
                    //error is already reported by parser
                    return createDummyOnValue()
                } else {
                    return this.currentContext[1].state[1].onValue
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
    data: BodyEvent,
    semanticState: SemanticState,
    overheadState: OverheadState,
    onError: (error: StackedDataError, range: Range) => void,
): ProcessResult {

    switch (data.type[0]) {
        case BodyEventType.CloseArray: {
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
                        return p.result(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        $$.arrayHandler.end(
                            data.range,
                            $,
                            contextData
                        )
                        semanticState.pop(data.range)
                        semanticState.wrapupValue(data.range)
                        return p.result(false)
                    }
                },
            }]
        }
        case BodyEventType.CloseObject: {
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
                        return p.result(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        if ($$.propertyHandler !== null) {
                            //was in the middle of processing a property
                            //the key was parsed, but the data was not
                            $$.propertyHandler.onMissing()
                            $$.propertyHandler = null
                        }
                        $$.objectHandler.end(
                            data.range,
                            $,
                            contextData
                        )
                        semanticState.pop(data.range)
                        semanticState.wrapupValue(data.range)
                        return p.result(false)
                    }

                },
            }]
        }
        case BodyEventType.Colon: {
            return ["other"]
        }
        case BodyEventType.Comma: {
            return ["other"]
        }
        case BodyEventType.OpenArray: {
            const $ = data.type[1]
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    const arrayHandler = semanticState.initValueHandler()(contextData).array(data.range, $)
                    semanticState.push(["array", { arrayHandler: arrayHandler }])
                    return p.result(false)
                },
            }]
        }
        case BodyEventType.OpenObject: {
            const $ = data.type[1]
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    const vh = semanticState.initValueHandler()(contextData)

                    const objectHandler = vh.object(
                        data.range,
                        $
                    )
                    semanticState.push(["object", {
                        objectHandler: objectHandler,
                        propertyHandler: null,
                    }])
                    return p.result(false)
                },
            }]
        }
        case BodyEventType.Overhead: {
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
        case BodyEventType.SimpleValue: {
            const $ = data.type[1]
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {

                    function onSimpleValue(vh: ValueHandler): p.IValue<boolean> {
                        if (DEBUG) { console.log("on simple value", $.value) }
                        semanticState.wrapupValue(data.range)
                        return vh.simpleValue(
                            data.range,
                            $,
                        )
                    }
                    switch (semanticState.currentContext[0]) {
                        case "array": {
                            const $ = semanticState.currentContext[1]
                            return onSimpleValue($.arrayHandler.element()(contextData))
                        }
                        case "object": {
                            const $$ = semanticState.currentContext[1]
                            if ($$.propertyHandler === null) {
                                if (semanticState.currentContext[0] !== "object") {
                                    raiseError(onError, ["unexpected key"], data.range)
                                    return p.result(false)
                                } else {
                                    return $$.objectHandler.property(
                                        data.range,
                                        $.value,
                                        contextData
                                    ).mapResult(propHandler => {
                                        $$.propertyHandler = propHandler
                                        return p.result(false)
                                    })
                                }
                            } else {
                                const $$$ = $$.propertyHandler
                                return onSimpleValue($$$.onValue(contextData))
                            }
                        }
                        case "root": {
                            const $ = semanticState.currentContext[1]
                            //handle case when root value was already processed
                            const vh = $.rootValueHandler !== null
                                ? $.rootValueHandler.onValue
                                : createDummyOnValue()
                            return onSimpleValue(vh(contextData))
                        }
                        case "taggedunion": {
                            const $$ = semanticState.currentContext[1]
                            switch ($$.state[0]) {
                                case "expecting option": {
                                    //const $$$ = $$.state[1]
                                    if (DEBUG) { console.log("on option", $.value) }
                                    $$.state = ["expecting value", $$.handler.option(
                                        data.range,
                                        $.value,
                                        contextData
                                    )]
                                    return p.result(false)
                                }
                                case "expecting value": {
                                    const $$$ = $$.state[1]
                                    return onSimpleValue($$$.onValue(contextData))
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
        case BodyEventType.TaggedUnion: {
            if (DEBUG) { console.log("on open tagged union") }
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    semanticState.push(["taggedunion", {
                        handler: semanticState.initValueHandler()(contextData).taggedUnion(
                            data.range,
                        ),
                        state: ["expecting option", {
                        }],
                    }])
                    return p.result(false)
                },
            }]
        }
        default:
            return assertUnreachable(data.type[0])
    }
}

/**
 * attachStackedDataSubscriber allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */
export function createStackedDataSubscriber<ReturnType, ErrorType>(
    valueHandler: RequiredValueHandler,
    onError: (error: StackedDataError, range: Range) => void,
    onEnd: () => p.IUnsafeValue<ReturnType, ErrorType>
): ParserEventConsumer<ReturnType, ErrorType> {
    const overheadState = new OverheadState()
    const semanticState = new SemanticState(valueHandler)

    let cachedEvent: null | EventData = null


    return {
        onData: (data: BodyEvent): p.IValue<boolean> => {
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
                        const res = flush(cachedEvent, $.comment, () => p.result(false))
                        cachedEvent = null
                        return res
                    } else {
                        overheadState.onCommend($.comment)
                        return p.result(false)
                    }
                }
                case "event": {
                    return flushPossibleQueuedEvent(() => {

                        const $ = processedParserEvent[1]
                        cachedEvent = $
                        overheadState.setLineDirty()
                        return p.result(false)

                    })
                }
                case "other": {

                    //const $ = odr[1]
                    overheadState.setLineDirty()

                    return p.result(false)

                }
                case "whitespace": {
                    const $ = processedParserEvent[1]
                    overheadState.onWhitespace($.value)

                    return p.result(false)
                }
                case "newline": {
                    return flushPossibleQueuedEvent(() => {

                        //const $ = odr[1]
                        overheadState.onNewline()
                        return p.result(false)

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