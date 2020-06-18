/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
    complexity: off,
    max-classes-per-file: off,
*/
import * as p from "pareto"
import { ParserEventType, BodyEvent } from "../BodyEvent"
import { Location, Range, createRangeFromSingleLocation } from "../location"
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
} from "./handlers"
import { RangeError } from "../errors"
import { ParserEventConsumer } from "../createParser"

const DEBUG = false

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

type WhiteSpaceState = {
    comments: Comment[]
    indentation: string
    lineIsDirty: boolean
}


class State {
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

type ProcessResult =
    | ["event", (contextData: ContextData) => p.IValue<boolean>]
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
    state: State,
    onError: (error: RangeError) => void,
): ProcessResult {

    switch (data.type[0]) {
        case ParserEventType.BlockComment: {
            const $ = data.type[1]
            return ["comment", {
                comment: {
                    text: $.comment,
                    type: "block",
                    indent: null, //FIX get the right indent info
                    outerRange: data.range,
                    innerRange: $.innerRange,
                },
            }]
        }
        case ParserEventType.CloseArray: {
            const $ = data.type[1]
            return ["event", contextData => {
                unwindLoop: while (true) {
                    switch (state.currentContext[0]) {
                        case "array": {
                            break unwindLoop
                        }
                        case "object": {
                            const $$2 = state.currentContext[1]
                            if ($$2.propertyHandler !== null) {
                                raiseError(onError, "missing property data", data.range)
                                $$2.propertyHandler.onMissing()
                                $$2.propertyHandler = null
                            }
                            raiseError(onError, "missing object close", data.range)
                            state.pop(data.range)
                            state.wrapupValue(data.range)
                            break
                        }
                        case "root": {
                            //const $ = state.currentContext[1]
                            break unwindLoop
                        }
                        case "taggedunion": {
                            //const $ = state.currentContext[1]
                            if (state.currentContext[1].state[0] === "expecting value") {
                                state.currentContext[1].state[1].onMissing()
                                raiseError(onError, "missing tagged union value", data.range)
                            } else {
                                raiseError(onError, "missing tagged union option and value", data.range)
                            }
                            state.pop(data.range)
                            state.wrapupValue(data.range)
                            break
                        }
                        default:
                            assertUnreachable(state.currentContext[0])
                    }
                }
                if (state.currentContext[0] !== "array") {
                    raiseError(onError, "unexpected end of array", data.range)
                    return p.result(false)
                } else {
                    const $$ = state.currentContext[1]
                    $$.arrayHandler.end(
                        data.range,
                        $,
                        contextData
                    )
                    state.pop(data.range)
                    state.wrapupValue(data.range)
                    return p.result(false)
                }
            }]
        }
        case ParserEventType.CloseObject: {
            const $ = data.type[1]
            return ["event", contextData => {
                unwindLoop: while (true) {
                    switch (state.currentContext[0]) {
                        case "array": {
                            //const $ = state.currentContext[1]
                            raiseError(onError, "missing array close", data.range)
                            state.pop(data.range)
                            state.wrapupValue(data.range)
                            break
                        }
                        case "object": {
                            break unwindLoop
                        }
                        case "root": {
                            //const $ = state.currentContext[1]

                            break unwindLoop
                        }
                        case "taggedunion": {
                            //const $ = state.currentContext[1]
                            if (state.currentContext[1].state[0] === "expecting value") {
                                state.currentContext[1].state[1].onMissing()
                                raiseError(onError, "missing tagged union value", data.range)
                            } else {
                                raiseError(onError, "missing tagged union option and value", data.range)
                            }
                            state.pop(data.range)
                            state.wrapupValue(data.range)
                            break
                        }
                        default:
                            assertUnreachable(state.currentContext[0])
                    }
                }
                if (state.currentContext[0] !== "object") {
                    raiseError(onError, "unexpected end of object", data.range)
                    return p.result(false)
                } else {
                    const $$ = state.currentContext[1]
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
                    state.pop(data.range)
                    state.wrapupValue(data.range)
                    return p.result(false)
                }

            }]
        }
        case ParserEventType.Colon: {
            return ["other"]
        }
        case ParserEventType.Comma: {
            return ["other"]
        }
        case ParserEventType.LineComment: {
            const $ = data.type[1]
            return ["comment", {
                comment: {
                    text: $.comment,
                    type: "line",
                    indent: null,
                    outerRange: data.range,
                    innerRange: $.innerRange,
                },
            }]
        }
        case ParserEventType.NewLine: {
            return ["newline"]
        }
        case ParserEventType.OpenArray: {
            const $ = data.type[1]
            return ["event", contextData => {
                const arrayHandler = state.initValueHandler()(contextData).array(data.range, $)
                state.push(["array", { arrayHandler: arrayHandler }])
                return p.result(false)
            }]
        }
        case ParserEventType.OpenObject: {
            const $ = data.type[1]
            return ["event", contextData => {
                const vh = state.initValueHandler()(contextData)

                const objectHandler = vh.object(
                    data.range,
                    $
                )
                state.push(["object", {
                    objectHandler: objectHandler,
                    propertyHandler: null,
                }])
                return p.result(false)
            }]
        }
        case ParserEventType.SimpleValue: {
            const $ = data.type[1]
            return ["event", contextData => {

                function onSimpleValue(vh: ValueHandler): p.IValue<boolean> {
                    if (DEBUG) { console.log("on simple value", $.value) }
                    state.wrapupValue(data.range)
                    return vh.simpleValue(
                        data.range,
                        $,
                    )
                }
                switch (state.currentContext[0]) {
                    case "array": {
                        const $ = state.currentContext[1]
                        return onSimpleValue($.arrayHandler.element()(contextData))
                    }
                    case "object": {
                        const $$ = state.currentContext[1]
                        if ($$.propertyHandler === null) {
                            if (state.currentContext[0] !== "object") {
                                raiseError(onError, "unexpected key", data.range)
                                return p.result(false)

                            } else {
                                $$.propertyHandler = $$.objectHandler.property(
                                    data.range,
                                    $.value,
                                    contextData
                                )
                                return p.result(false)
                            }
                        } else {
                            const $$$ = $$.propertyHandler
                            return onSimpleValue($$$.onValue(contextData))
                        }
                    }
                    case "root": {
                        const $ = state.currentContext[1]
                        //handle case when root value was already processed
                        const vh = $.rootValueHandler !== null
                            ? $.rootValueHandler.onValue
                            : createDummyOnValue()
                        return onSimpleValue(vh(contextData))
                    }
                    case "taggedunion": {
                        const $$ = state.currentContext[1]
                        switch ($$.state[0]) {
                            case "expecting option": {
                                const $$$ = $$.state[1]
                                if (DEBUG) { console.log("on option", $.value) }
                                $$.state = ["expecting value", $$$.handler.option(
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
                        return assertUnreachable(state.currentContext[0])
                }
            }]
        }
        case ParserEventType.TaggedUnion: {
            if (DEBUG) { console.log("on open tagged union") }
            return ["event", contextData => {
                state.push(["taggedunion", {
                    state: ["expecting option", {
                        handler: state.initValueHandler()(contextData).taggedUnion(
                            data.range,
                        ),
                    }],
                }])
                return p.result(false)
            }]
        }
        case ParserEventType.WhiteSpace: {
            const $ = data.type[1]
            return ["whitespace", {
                value: $.value,
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
    onError: (error: RangeError) => void,
    onEnd: (contextData: ContextData) => p.IUnsafeValue<ReturnType, ErrorType>
): ParserEventConsumer<ReturnType, ErrorType> {
    const whiteSpaceState: WhiteSpaceState = {
        comments: [],
        indentation: "",
        lineIsDirty: false,
    }

    const state = new State(valueHandler)

    type GenerateQueuedEvent = ((contextData: ContextData) => p.IValue<boolean>)

    let generateQueuedEvent: null | GenerateQueuedEvent = null


    const ds: ParserEventConsumer<ReturnType, ErrorType> = {
        onData: (data: BodyEvent): p.IValue<boolean> => {
            function flush(
                gqe: GenerateQueuedEvent,
                lineCommentAfter: Comment | null,
                after: () => p.IValue<boolean>
            ) {
                function flushContextData(): ContextData {
                    const contextData: ContextData = {
                        commentsBefore: whiteSpaceState.comments,
                        indentation: whiteSpaceState.indentation,
                        lineCommentAfter: lineCommentAfter,
                    }
                    whiteSpaceState.comments = []
                    whiteSpaceState.indentation = ""
                    whiteSpaceState.lineIsDirty = false
                    return contextData
                }

                return gqe(flushContextData()).mapResult(_abortRequested => {
                    return after()
                })
            }
            function flushPossibleQueuedEvent(after: () => p.IValue<boolean>) {

                if (generateQueuedEvent === null) {
                    return after()
                } else {
                    const res = flush(generateQueuedEvent, null, after)
                    generateQueuedEvent = null
                    return res
                }

            }
            const processedParserEvent = processParserEvent(data, state, onError)

            switch (processedParserEvent[0]) {
                case "comment": {
                    const $ = processedParserEvent[1]

                    if ($.comment.type === "line" && generateQueuedEvent !== null) {
                        whiteSpaceState.lineIsDirty = true
                        const res = flush(generateQueuedEvent, $.comment, () => p.result(false))
                        generateQueuedEvent = null
                        return res
                    } else {
                        whiteSpaceState.lineIsDirty = true
                        whiteSpaceState.comments.push($.comment)
                        return p.result(false)
                    }
                }
                case "event": {
                    return flushPossibleQueuedEvent(() => {

                        const $ = processedParserEvent[1]
                        generateQueuedEvent = $
                        whiteSpaceState.lineIsDirty = true
                        return p.result(false)

                    })
                }
                case "other": {

                    //const $ = odr[1]
                    whiteSpaceState.lineIsDirty = true

                    return p.result(false)

                }
                case "whitespace": {
                    const $ = processedParserEvent[1]

                    if (!whiteSpaceState.lineIsDirty) {
                        whiteSpaceState.indentation = $.value
                    }
                    return p.result(false)
                }
                case "newline": {
                    return flushPossibleQueuedEvent(() => {

                        //const $ = odr[1]
                        whiteSpaceState.indentation = ""
                        whiteSpaceState.lineIsDirty = false
                        return p.result(false)

                    })
                }
                default:
                    return assertUnreachable(processedParserEvent[0])
            }
        },
        onEnd: (aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> => {
            function flushContextData(): ContextData {
                const contextData: ContextData = {
                    commentsBefore: whiteSpaceState.comments,
                    indentation: whiteSpaceState.indentation,
                    lineCommentAfter: null,
                }
                whiteSpaceState.comments = []
                whiteSpaceState.indentation = ""
                whiteSpaceState.lineIsDirty = false
                return contextData
            }
            function onEnd2() {

                const range = createRangeFromSingleLocation(location)
                if (!aborted) {
                    unwindLoop: while (true) {
                        switch (state.currentContext[0]) {
                            case "root": {
                                const $ = state.currentContext[1]
                                if ($.rootValueHandler !== null) {
                                    $.rootValueHandler.onMissing()
                                    $.rootValueHandler = null
                                }
                                break unwindLoop
                            }
                            case "array": {
                                raiseError(onError, "unexpected end of document, still in array", range)
                                state.pop(range)
                                state.wrapupValue(range)
                                break
                            }
                            case "object": {
                                const $ = state.currentContext[1]
                                if ($.propertyHandler !== null) {
                                    $.propertyHandler.onMissing()
                                    $.propertyHandler = null
                                }
                                raiseError(onError, "unexpected end of document, still in object", range)
                                state.pop(range)
                                state.wrapupValue(range)
                                break
                            }
                            case "taggedunion": {
                                const $ = state.currentContext[1]
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
                                state.wrapupValue(range)

                                break
                            }
                            default:
                                assertUnreachable(state.currentContext[0])
                        }
                    }
                }
                return onEnd(flushContextData())
            }
            if (generateQueuedEvent === null) {
                return onEnd2()
            } else {
                const gqe = generateQueuedEvent
                generateQueuedEvent = null
                return gqe(flushContextData()).try(_abortRequested => {
                    return onEnd2()
                })
            }
        },
    }
    return ds
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}