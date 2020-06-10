/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
    complexity: off,
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
    const stack: ContextType[] = []
    let comments: Comment[] = []
    let indentation = ""
    let lineIsDirty = false

    let currentContext: ContextType = ["root", { rootValueHandler: valueHandler }]

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

    function pop(range: Range) {
        const previousContext = stack.pop()
        if (previousContext === undefined) {
            throw new StackedDataSubscriberPanic("unexpected end of stack", range)
        } else {
            currentContext = previousContext
        }
    }
    function initValueHandler(): ValueHandler {
        switch (currentContext[0]) {
            case "array": {
                return currentContext[1].arrayHandler.element()
            }
            case "object": {
                if (currentContext[1].propertyHandler === null) {
                    //expected a key or end of the object
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return currentContext[1].propertyHandler.valueHandler
                }
            }
            case "root": {
                const vh = currentContext[1].rootValueHandler
                if (vh === null) {
                    //expected end of document
                    //error is already reported by parser
                    return createDummyValueHandler()

                }
                return vh.valueHandler
            }
            case "taggedunion": {
                if (currentContext[1].state[0] !== "expecting value") {
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return currentContext[1].state[1].valueHandler
                }
            }
            default:
                return assertUnreachable(currentContext[0])
        }
    }
    function wrapupValue(range: Range): void {
        switch (currentContext[0]) {
            case "array": {
                break
            }
            case "object": {
                currentContext[1].propertyHandler = null
                break
            }
            case "root": {
                currentContext[1].rootValueHandler = null
                break
            }
            case "taggedunion": {
                if (currentContext[1].state[0] !== "expecting value") {
                    //error is already reported by parser
                } else {
                    pop(range)
                    wrapupValue(range)
                }
                break
            }
            default:
                return assertUnreachable(currentContext[0])
        }
    }
    // function getAfterValueContext(): AfterValueContext {
    //     switch (currentContext[0]) {
    //         case "array": {
    //             return AfterValueContext.ARRAY
    //         }
    //         case "object": {
    //             return AfterValueContext.OBJECT
    //         }
    //         case "root": {
    //             return AfterValueContext.END
    //         }
    //         case "taggedunion": {
    //             if (currentContext[1].valueHandler === null) {
    //                 //error is already reported by parser
    //                 return createDummyValueHandler()
    //             } else {
    //                 return currentContext[1].valueHandler
    //             }
    //         }
    //         default:
    //             return assertUnreachable(currentContext[0])
    //     }
    // }

    const ds: ParserEventConsumer<ReturnType, ErrorType> = {
        onData: (data: ParserEvent) => {
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
                    lineIsDirty = true
                    unwindLoop: while (true) {
                        switch (currentContext[0]) {
                            case "array": {
                                //const $ = currentContext[1]
                                currentContext[1].arrayHandler.end(
                                    data.range,
                                    $,
                                    flushContextData()
                                )
                                pop(data.range)
                                wrapupValue(data.range)
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
                                pop(data.range)
                                wrapupValue(data.range)
                                break
                            }
                            case "root": {
                                //const $ = currentContext[1]
                                raiseError(onError, "unexpected end of array", data.range)
                                break unwindLoop
                            }
                            case "taggedunion": {
                                //const $ = currentContext[1]
                                if (currentContext[1].state[0] === "expecting value") {
                                    currentContext[1].state[1].onMissing()
                                    raiseError(onError, "missing tagged union value", data.range)
                                } else {
                                    raiseError(onError, "missing tagged union option and value", data.range)
                                }
                                pop(data.range)
                                wrapupValue(data.range)
                                break
                            }
                            default:
                                assertUnreachable(currentContext[0])
                        }
                    }
                    return p.result(false)
                }
                case ParserEventType.CloseObject: {
                    const $ = data.type[1]
                    if (DEBUG) { console.log("on close object") }
                    lineIsDirty = true
                    unwindLoop: while (true) {
                        switch (currentContext[0]) {
                            case "array": {
                                //const $ = currentContext[1]
                                raiseError(onError, "missing array close", data.range)
                                pop(data.range)
                                wrapupValue(data.range)
                                break
                            }
                            case "object": {
                                const $$ = currentContext[1]
                                if ($$.propertyHandler !== null) {
                                    //was in the middle of processing a property
                                    //the key was parsed, but the data was not
                                    $$.propertyHandler.onMissing()
                                    $$.propertyHandler = null
                                }
                                currentContext[1].objectHandler.end(
                                    data.range,
                                    $,
                                    flushContextData()
                                )
                                pop(data.range)
                                wrapupValue(data.range)
                                break unwindLoop
                            }
                            case "root": {
                                //const $ = currentContext[1]
                                raiseError(onError, "unexpected end of object", data.range)

                                break unwindLoop
                            }
                            case "taggedunion": {
                                //const $ = currentContext[1]
                                if (currentContext[1].state[0] === "expecting value") {
                                    currentContext[1].state[1].onMissing()
                                    raiseError(onError, "missing tagged union value", data.range)
                                } else {
                                    raiseError(onError, "missing tagged union option and value", data.range)
                                }
                                pop(data.range)
                                wrapupValue(data.range)
                                break
                            }
                            default:
                                assertUnreachable(currentContext[0])
                        }
                    }
                    return p.result(false)
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
                case ParserEventType.NewLine: {
                    lineIsDirty = false
                    indentation = ""
                    return p.result(false)
                }
                case ParserEventType.OpenArray: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    const arrayHandler = initValueHandler().array(
                        data.range,
                        $,
                        flushContextData()
                    )
                    stack.push(currentContext)
                    currentContext = ["array", { arrayHandler: arrayHandler }]
                    return p.result(false)
                }
                case ParserEventType.OpenObject: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    if (DEBUG) { console.log("on open object") }
                    const vh = initValueHandler()
                    const objectHandler = vh.object(
                        data.range,
                        $,
                        flushContextData()
                    )
                    stack.push(currentContext)
                    currentContext = ["object", {
                        objectHandler: objectHandler,
                        propertyHandler: null,
                    }]
                    return p.result(false)
                }
                case ParserEventType.SimpleValue: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    function onSimpleValue(vh: ValueHandler) {
                        if (DEBUG) { console.log("on simple value", $.value) }
                        const res = vh.simpleValue(
                            data.range,
                            $,
                            flushContextData()
                        )
                        wrapupValue(data.range)
                        return res
                    }
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
                                } else {
                                    currentContext[1].propertyHandler = currentContext[1].objectHandler.property(
                                        data.range,
                                        $.value,
                                        flushContextData()
                                    )
                                }
                                return p.result(false)
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
                                    const rvh = $$$.handler.option(
                                        data.range,
                                        $.value,
                                        flushContextData()
                                    )
                                    $$.state = ["expecting value", rvh]
                                    break
                                }
                                case "expecting value": {
                                    const $$$ = $$.state[1]
                                    return onSimpleValue($$$.valueHandler)
                                }
                                default:
                                    assertUnreachable($$.state[0])
                            }
                            break
                        }
                        default:
                            return assertUnreachable(currentContext[0])
                    }
                    return p.result(false)
                }
                case ParserEventType.TaggedUnion: {
                    lineIsDirty = true
                    if (DEBUG) { console.log("on open tagged union") }
                    stack.push(currentContext)
                    currentContext = ["taggedunion", {
                        state: ["expecting option", {
                            handler: initValueHandler().taggedUnion(
                                data.range,
                                flushContextData(),
                            ),
                        }],
                    }]
                    return p.result(false)
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
            const range = { start: location, end: location }
            if (!aborted) {
                unwindLoop: while (true) {
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
                            pop(range)
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
                            pop(range)
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
                            pop(range)
                            wrapupValue(range)

                            break
                        }
                        default:
                            assertUnreachable(currentContext[0])
                    }
                }
            }
            return onEnd(flushContextData())
        },
    }
    return ds
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}