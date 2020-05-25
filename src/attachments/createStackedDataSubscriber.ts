/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
    complexity: off,
*/
import * as p from "pareto"
import { IParserEventConsumer, ParserEvent, ParserEventType } from "../IParserEventConsumer"
import { Location, Range } from "../location"
import { createDummyValueHandler } from "./dummyHandlers"
import {
    RequiredValueHandler,
    ValueHandler,
    ObjectHandler,
    ArrayHandler,
    Comment,
    PreData,
    TaggedUnionHandler,
} from "./handlers"
import { RangeError } from "../errors"

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

/**
 * attachStackedDataSubscriber allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */
export function createStackedDataSubscriber(
    valueHandler: RequiredValueHandler,
    onError: (error: RangeError) => void,
    onend: (preData: PreData) => void
): IParserEventConsumer {
    const stack: ContextType[] = []
    let comments: Comment[] = []
    let indentation = ""
    let lineIsDirty = false

    let endIsSignalled = false

    let currentContext: ContextType = ["root", { rootValueHandler: valueHandler }]

    function flushPreData(): PreData {
        const preData = {
            comments: comments,
            indentation: indentation,
        }
        comments = []
        indentation = ""
        lineIsDirty = false
        return preData
    }

    function pop(range: Range) {
        const previousContext = stack.pop()
        if (previousContext === undefined) {
            raiseError(onError, "lost context", range)
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
                endIsSignalled = true
                currentContext[1].rootValueHandler = null

                onend(flushPreData())
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

    const ds: IParserEventConsumer = {
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
                    break
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
                                    flushPreData()
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
                    break
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
                                    flushPreData()
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
                    break
                }
                case ParserEventType.Colon: {
                    //const $ = data.type[1]
                    lineIsDirty = true
                    break
                }
                case ParserEventType.Comma: {
                    //const $ = data.type[1]
                    lineIsDirty = true
                    break
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
                    break
                }
                case ParserEventType.NewLine: {
                    lineIsDirty = false
                    indentation = ""
                    break
                }
                case ParserEventType.OpenArray: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    const arrayHandler = initValueHandler().array(
                        data.range,
                        $,
                        flushPreData()
                    )
                    stack.push(currentContext)
                    currentContext = ["array", { arrayHandler: arrayHandler }]
                    break
                }
                case ParserEventType.OpenObject: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    if (DEBUG) { console.log("on open object") }
                    const vh = initValueHandler()
                    const objectHandler = vh.object(
                        data.range,
                        $,
                        flushPreData()
                    )
                    stack.push(currentContext)
                    currentContext = ["object", {
                        objectHandler: objectHandler,
                        propertyHandler: null,
                    }]
                    break
                }
                case ParserEventType.SimpleValue: {
                    const $ = data.type[1]
                    lineIsDirty = true
                    function onSimpleValue(vh: ValueHandler) {
                        if (DEBUG) { console.log("on simple value", $.value) }
                        vh.simpleValue(
                            data.range,
                            $,
                            flushPreData()
                        )
                        wrapupValue(data.range)
                    }
                    switch (currentContext[0]) {
                        case "array": {
                            const $ = currentContext[1]
                            onSimpleValue($.arrayHandler.element())
                            break
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
                                        flushPreData()
                                    )
                                }
                            } else {
                                onSimpleValue($$.propertyHandler.valueHandler)
                            }
                            break
                        }
                        case "root": {
                            const $ = currentContext[1]
                            //handle case when root value was already processed
                            const vh = $.rootValueHandler !== null
                                ? $.rootValueHandler.valueHandler
                                : createDummyValueHandler()
                            onSimpleValue(vh)
                            break
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
                                        flushPreData()
                                    )
                                    $$.state = ["expecting value", rvh]
                                    break
                                }
                                case "expecting value": {
                                    const $$$ = $$.state[1]
                                    onSimpleValue($$$.valueHandler)

                                    break
                                }
                                default:
                                    assertUnreachable($$.state[0])
                            }
                            break
                        }
                        default:
                            return assertUnreachable(currentContext[0])
                    }
                    break
                }
                case ParserEventType.TaggedUnion: {
                    lineIsDirty = true
                    if (DEBUG) { console.log("on open tagged union") }
                    stack.push(currentContext)
                    currentContext = ["taggedunion", {
                        state: ["expecting option", {
                            handler: initValueHandler().taggedUnion(
                                data.range,
                                flushPreData(),
                            ),
                        }],
                    }]
                    break
                }
                case ParserEventType.WhiteSpace: {
                    const $ = data.type[1]
                    if (!lineIsDirty) {
                        indentation = $.value
                    }
                    break
                }
                default:
                    assertUnreachable(data.type[0])
            }
            return p.result(false)
        },
        onEnd: (_aborted: boolean, location: Location): void => {
            const range = { start: location, end: location }
            unwindLoop: while (true) {
                function popStack() {
                    const popped = stack.pop()
                    if (popped === undefined) {
                        throw new StackedDataSubscriberPanic("unexpected end of stack", range)
                    } else {
                        currentContext = popped
                    }
                }
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
                        popStack()
                        break
                    }
                    case "object": {
                        const $ = currentContext[1]
                        if ($.propertyHandler !== null) {
                            $.propertyHandler.onMissing()
                            $.propertyHandler = null
                        }
                        raiseError(onError, "unexpected end of document, still in object", range)
                        popStack()
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
                        popStack()

                        break
                    }
                    default:
                        assertUnreachable(currentContext[0])
                }
            }
            if (!endIsSignalled) {
                onend(flushPreData())
            }
        },
    }
    return ds
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}