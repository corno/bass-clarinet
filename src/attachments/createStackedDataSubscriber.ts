/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
    complexity: off,
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import { ParserEventType, ParserEvent } from "../ParserEvent"
import { Location, Range } from "../location"
import { createDummyValueHandler } from "./dummyHandlers"
import {
    RequiredValueHandler,
    ValueHandler,
    ObjectHandler,
    ArrayHandler,
    Comment,
    ContextData,
    TaggedUnionHandler,
} from "./handlers"
import { RangeError } from "../errors"
import { ParserEventConsumer } from "../createParser"

const DEBUG = false

// class StackedDataSubscriberPanic extends RangeError {
//     constructor(message: string, range: Range) {
//         super(`stack panic: ${message}`, range)
//     }
// }


class StackedDataSubscriberPanic extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

type TaggedUnionState =
    | ["expecting option", {
        readonly handler: TaggedUnionHandler
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
        state: TaggedUnionState
    }]

function raiseError(onError: (error: RangeError) => void, message: string, range: Range) {
    onError(new RangeError(message, range))
}

class State {
    private readonly stack: ContextType[] = []
    private currentContext: ContextType
    constructor(valueHandler: RequiredValueHandler) {
        this.currentContext = ["root", { rootValueHandler: valueHandler }]
    }

    public pop(range: Range) {
        const previousContext = this.stack.pop()
        if (previousContext === undefined) {
            throw new StackedDataSubscriberPanic("unexpected end of stack", range)
        } else {
            this.currentContext = previousContext
        }
    }
    public push(newContext: ContextType) {
        this.stack.push(this.currentContext)
        this.currentContext = newContext
    }
    public getCurrentContext() {
        return this.currentContext
    }
}

type GenerateEvent = (contextData: ContextData) => p.IValue<boolean>

/**
 * attachStackedDataSubscriber allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */
export function createStackedDataSubscriber<ReturnType, ErrorType>(
    valueHandler: RequiredValueHandler,
    onError: (error: RangeError) => void,
    onEnd: (contextData: ContextData) => p.IUnsafeValue<ReturnType, ErrorType>
): ParserEventConsumer<ReturnType, ErrorType> {
    let comments: Comment[] = []
    let indentation = ""
    let lineIsDirty = false

    const state = new State(valueHandler)

    let generateQueuedEvent: null | GenerateEvent = null


    function initValueHandler(): ValueHandler {
        const currentContext = state.getCurrentContext()
        switch (currentContext[0]) {
            case "array": {
                const $ = currentContext[1]
                return $.arrayHandler.element()
            }
            case "object": {
                const $ = currentContext[1]
                if ($.propertyHandler === null) {
                    //expected a key or end of the object
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return $.propertyHandler.valueHandler
                }
            }
            case "root": {
                const $ = currentContext[1]
                const vh = $.rootValueHandler
                if (vh === null) {
                    //expected end of document
                    //error is already reported by parser
                    return createDummyValueHandler()

                }
                return vh.valueHandler
            }
            case "taggedunion": {
                const $ = currentContext[1]
                if ($.state[0] !== "expecting value") {
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return $.state[1].valueHandler
                }
            }
            default:
                return assertUnreachable(currentContext[0])
        }
    }
    function wrapupValue(range: Range): void {
        const currentContext = state.getCurrentContext()

        switch (currentContext[0]) {
            case "array": {
                break
            }
            case "object": {
                const $ = currentContext[1]
                $.propertyHandler = null
                break
            }
            case "root": {
                const $ = currentContext[1]
                $.rootValueHandler = null
                break
            }
            case "taggedunion": {
                const $ = currentContext[1]
                if ($.state[0] !== "expecting value") {
                    //error is already reported by parser
                } else {
                    state.pop(range)
                    wrapupValue(range)
                }
                break
            }
            default:
                return assertUnreachable(currentContext[0])
        }
    }

    const ds: ParserEventConsumer<ReturnType, ErrorType> = {
        onData: (data: ParserEvent) => {

            function setQueuedEvent(qe: GenerateEvent) {

                generateQueuedEvent = qe
                return p.result(false)
            }
            function flush(after: () => p.IValue<boolean>): p.IValue<boolean> {
                if (generateQueuedEvent !== null) {

                    const contextData: ContextData = {
                        commentsBefore: comments,
                        indentation: indentation,
                        lineCommentAfter: null,
                    }
                    comments = []
                    indentation = ""
                    lineIsDirty = false
                    const gqe = generateQueuedEvent
                    generateQueuedEvent = null
                    return gqe(contextData).mapResult(_abortRequested => {
                        return after()
                    })
                } else {
                    return after()
                }
            }
            switch (data.type[0]) {
                case ParserEventType.BlockComment: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    comments.push({
                        text: $.comment,
                        type: "line",
                        indent: null, //FIX get the right indent info
                        outerRange: data.range,
                        innerRange: $.innerRange,
                    })
                    //place your code here
                    return p.result(false)
                }
                case ParserEventType.CloseArray: {
                    const $ = data.type[1]
                    return flush(() => {

                        lineIsDirty = true
                        unwindLoop: while (true) {
                            const currentContext = state.getCurrentContext()
                            switch (currentContext[0]) {
                                case "array": {
                                    break unwindLoop
                                }
                                case "object": {
                                    const $$ = currentContext[1]
                                    if ($$.propertyHandler !== null) {
                                        raiseError(onError, "missing property data", data.range)
                                        $$.propertyHandler.onMissing()
                                        $$.propertyHandler = null
                                    }
                                    raiseError(onError, "missing object close", data.range)

                                    state.pop(data.range)
                                    wrapupValue(data.range)
                                    break
                                }
                                case "root": {
                                    break unwindLoop
                                }
                                case "taggedunion": {
                                    const $ = currentContext[1]
                                    if ($.state[0] === "expecting value") {
                                        $.state[1].onMissing()
                                        raiseError(onError, "missing tagged union value", data.range)
                                    } else {
                                        raiseError(onError, "missing tagged union option and value", data.range)
                                    }

                                    state.pop(data.range)
                                    wrapupValue(data.range)
                                    break
                                }
                                default:
                                    assertUnreachable(currentContext[0])
                            }
                        }
                        {
                            const currentContext = state.getCurrentContext()
                            if (currentContext[0] !== "array") {
                                raiseError(onError, "unexpected end of array", data.range)
                                return p.result(false)
                            } else {
                                const $$ = currentContext[1]
                                return setQueuedEvent(contextData => {
                                    $$.arrayHandler.end(
                                        data.range,
                                        $,
                                        contextData
                                    )

                                    state.pop(data.range)
                                    wrapupValue(data.range)
                                    return p.result(false)
                                })
                            }
                        }
                    })
                }
                case ParserEventType.CloseObject: {
                    const $ = data.type[1]
                    if (DEBUG) { console.log("on close object") }
                    return flush(() => {
                        lineIsDirty = true
                        unwindLoop: while (true) {
                            const currentContext = state.getCurrentContext()
                            switch (currentContext[0]) {
                                case "array": {
                                    //const $ = currentContext[1]
                                    raiseError(onError, "missing array close", data.range)

                                    state.pop(data.range)
                                    wrapupValue(data.range)
                                    break
                                }
                                case "object": {
                                    break unwindLoop
                                }
                                case "root": {
                                    break unwindLoop
                                }
                                case "taggedunion": {
                                    const $$ = currentContext[1]
                                    if ($$.state[0] === "expecting value") {
                                        $$.state[1].onMissing()
                                        raiseError(onError, "missing tagged union value", data.range)
                                    } else {
                                        raiseError(onError, "missing tagged union option and value", data.range)
                                    }

                                    state.pop(data.range)
                                    wrapupValue(data.range)
                                    break
                                }
                                default:
                                    assertUnreachable(currentContext[0])
                            }
                        }
                        {
                            const currentContext = state.getCurrentContext()
                            if (currentContext[0] !== "object") {
                                raiseError(onError, "unexpected end of object", data.range)
                                return p.result(false)
                            } else {
                                const $$ = currentContext[1]
                                if ($$.propertyHandler !== null) {
                                    //was in the middle of processing a property
                                    //the key was parsed, but the value was not
                                    $$.propertyHandler.onMissing()
                                    $$.propertyHandler = null
                                }
                                return setQueuedEvent(contextData => {

                                    $$.objectHandler.end(
                                        data.range,
                                        $,
                                        contextData
                                    )

                                    state.pop(data.range)
                                    wrapupValue(data.range)
                                    return p.result(false)
                                })
                            }
                        }
                    })
                }
                case ParserEventType.Colon: {
                    //const $ = data.type[1]
                    lineIsDirty = true
                    return p.result(false)
                }
                case ParserEventType.Comma: {
                    //const $ = data.type[1]
                    lineIsDirty = true
                    return p.result(false)
                }
                case ParserEventType.LineComment: {
                    const $ = data.type[1]
                    if (generateQueuedEvent !== null) {
                        const contextData: ContextData = {
                            commentsBefore: comments,
                            indentation: indentation,
                            lineCommentAfter: {
                                text: $.comment,
                                type: "line",
                                indent: null,
                                outerRange: data.range,
                                innerRange: $.innerRange,
                            },
                        }
                        comments = []
                        indentation = ""
                        lineIsDirty = false
                        const gqe = generateQueuedEvent
                        generateQueuedEvent = null
                        return gqe(contextData)
                    } else {
                        const $ = data.type[1]
                        lineIsDirty = true
                        comments.push({
                            text: $.comment,
                            type: "line",
                            indent: null,
                            outerRange: data.range,
                            innerRange: $.innerRange,
                        })
                        return p.result(false)
                    }
                }
                case ParserEventType.NewLine: {
                    lineIsDirty = false
                    indentation = ""
                    return flush(() => p.result(false))
                }
                case ParserEventType.OpenArray: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    return flush(() => {
                        return setQueuedEvent(contextData => {

                            const arrayHandler = initValueHandler().array(
                                data.range,
                                $,
                                contextData
                            )
                            state.push(["array", { arrayHandler: arrayHandler }])
                            return p.result(false)
                        })
                    })
                }
                case ParserEventType.OpenObject: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    if (DEBUG) { console.log("on open object") }
                    return flush(() => {
                        return setQueuedEvent(contextData => {

                            const vh = initValueHandler()
                            state.push(["object", {
                                objectHandler: vh.object(
                                    data.range,
                                    $,
                                    contextData
                                ),
                                propertyHandler: null,
                            }])
                            return p.result(false)
                        })
                    })
                }
                case ParserEventType.SimpleValue: {
                    const $ = data.type[1]
                    return flush(() => {

                        lineIsDirty = true
                        function onSimpleValue(vh: ValueHandler) {
                            if (DEBUG) { console.log("on simple value", $.value) }
                            return setQueuedEvent(contextData => {
                                wrapupValue(data.range)
                                return vh.simpleValue(
                                    data.range,
                                    $,
                                    contextData
                                )
                            })
                        }
                        const currentContext = state.getCurrentContext()
                        switch (currentContext[0]) {
                            case "array": {
                                const $ = currentContext[1]
                                return onSimpleValue($.arrayHandler.element())
                            }
                            case "object": {
                                const $$ = currentContext[1]
                                if ($$.propertyHandler === null) {
                                    if (DEBUG) { console.log("on key", $.value) }
                                    if (currentContext[0] !== "object") {
                                        raiseError(onError, "unexpected key", data.range)
                                        return p.result(false)

                                    } else {
                                        return setQueuedEvent(contextData => {
                                            $$.propertyHandler = $$.objectHandler.property(
                                                data.range,
                                                $.value,
                                                contextData
                                            )
                                            return p.result(false)
                                        })
                                    }
                                } else {
                                    return onSimpleValue($$.propertyHandler.valueHandler)
                                }
                            }
                            case "root": {

                                const $ = currentContext[1]
                                //handle case when root value was already processed
                                const vh = $.rootValueHandler !== null
                                    ? $.rootValueHandler.valueHandler
                                    : createDummyValueHandler()
                                return onSimpleValue(vh)
                            }
                            case "taggedunion": {
                                const $$ = currentContext[1]

                                switch ($$.state[0]) {
                                    case "expecting option": {
                                        const $$$ = $$.state[1]
                                        if (DEBUG) { console.log("on option", $.value) }

                                        return setQueuedEvent(contextData => {

                                            const rvh = $$$.handler.option(
                                                data.range,
                                                $.value,
                                                contextData
                                            )
                                            $$.state = ["expecting value", rvh]
                                            return p.result(false)
                                        })
                                    }
                                    case "expecting value": {
                                        const $$$ = $$.state[1]
                                        return onSimpleValue($$$.valueHandler)
                                    }
                                    default:
                                        return assertUnreachable($$.state[0])
                                }
                            }
                            default:
                                return assertUnreachable(currentContext[0])
                        }
                    })
                }
                case ParserEventType.TaggedUnion: {

                    lineIsDirty = true
                    if (DEBUG) { console.log("on open tagged union") }
                    return flush(() => {
                        return setQueuedEvent(contextData => {
                            state.push(["taggedunion", {
                                state: ["expecting option", {
                                    handler: initValueHandler().taggedUnion(
                                        data.range,
                                        contextData,
                                    ),
                                }],
                            }])
                            return p.result(false)
                        })
                    })
                }
                case ParserEventType.WhiteSpace: {

                    const $ = data.type[1]
                    if (!lineIsDirty) {
                        indentation = $.value
                    }
                    return p.result(false)
                }
                default:
                    return assertUnreachable(data.type[0])
            }
        },
        onEnd: (aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> => {
            function flushContextData(): ContextData {
                const contextData: ContextData = {
                    commentsBefore: comments,
                    indentation: indentation,
                    lineCommentAfter: null,
                }
                comments = []
                indentation = ""
                lineIsDirty = false
                return contextData
            }
            function onEnd2(): p.IUnsafeValue<ReturnType, ErrorType> {
                const range = { start: location, end: location }
                if (!aborted) {
                    unwindLoop: while (true) {
                        const currentContext = state.getCurrentContext()

                        switch (currentContext[0]) {
                            case "root": {
                                const $ = currentContext[1]
                                if ($.rootValueHandler !== null) {
                                    $.rootValueHandler.onMissing()
                                    $.rootValueHandler = null
                                }
                                break unwindLoop
                            }
                            case "array": {
                                raiseError(onError, "unexpected end of document, still in array", range)

                                state.pop(range)
                                wrapupValue(range)
                                break
                            }
                            case "object": {
                                const $ = currentContext[1]
                                if ($.propertyHandler !== null) {
                                    $.propertyHandler.onMissing()
                                    $.propertyHandler = null
                                }
                                raiseError(onError, "unexpected end of document, still in object", range)

                                state.pop(range)
                                wrapupValue(range)
                                break
                            }
                            case "taggedunion": {
                                const $ = currentContext[1]
                                switch ($.state[0]) {
                                    case "expecting option": {
                                        const $$ = $.state[1]
                                        $$.handler.missingOption()
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
                                raiseError(onError, "unexpected end of document, still in tagged union", range)

                                state.pop(range)
                                wrapupValue(range)

                                break
                            }
                            default:
                                assertUnreachable(currentContext[0])
                        }
                    }
                }
                return onEnd(flushContextData())

            }
            if (generateQueuedEvent !== null) {
                const res = generateQueuedEvent(flushContextData()).try(_abortRequested => {
                    return onEnd2()
                })
                generateQueuedEvent = null
                return res
            } else {
                return onEnd2()
            }
        },
    }
    return ds
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}