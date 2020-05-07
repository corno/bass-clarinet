/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
*/
import { IDataSubscriber } from "../IDataSubscriber"
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
): IDataSubscriber {
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

    return {
        onComma: () => {
            lineIsDirty = true
            //
        },
        onColon: () => {
            lineIsDirty = true
            //
        },
        onNewLine: () => {
            lineIsDirty = false
            indentation = ""

            //
        },
        onWhitespace: (value: string) => {
            if (!lineIsDirty) {
                indentation = value
            }
            //
        },
        onLineComment: (comment, metaData) => {
            lineIsDirty = true
            comments.push({
                text: comment,
                type: "line",
                indent: null,
                range: metaData.range,
            })
        },
        onBlockComment: (comment, metaData) => {
            lineIsDirty = true
            comments.push({
                text: comment,
                type: "line",
                indent: null, //FIX get the right indent info
                range: metaData.range,
            })
        },
        onOpenArray: metaData => {
            lineIsDirty = true
            const arrayHandler = initValueHandler().array(
                metaData,
                flushPreData()
            )
            stack.push(currentContext)
            currentContext = ["array", { arrayHandler: arrayHandler }]
        },
        onCloseArray: metaData => {
            lineIsDirty = true
            unwindLoop: while (true) {
                switch (currentContext[0]) {
                    case "array": {
                        //const $ = currentContext[1]
                        currentContext[1].arrayHandler.end(
                            metaData,
                            flushPreData()
                        )
                        pop(metaData.range)
                        wrapupValue(metaData.range)
                        break unwindLoop
                    }
                    case "object": {
                        const $ = currentContext[1]
                        if ($.propertyHandler !== null) {
                            raiseError(onError, "missing property data", metaData.range)
                            $.propertyHandler.onMissing()
                            $.propertyHandler = null
                        }
                        raiseError(onError, "missing object close", metaData.range)
                        pop(metaData.range)
                        wrapupValue(metaData.range)
                        break
                    }
                    case "root": {
                        //const $ = currentContext[1]
                        raiseError(onError, "unexpected end of array", metaData.range)

                        break unwindLoop
                    }
                    case "taggedunion": {
                        //const $ = currentContext[1]
                        if (currentContext[1].state[0] === "expecting value") {
                            currentContext[1].state[1].onMissing()
                            raiseError(onError, "missing tagged union value", metaData.range)
                        } else {
                            raiseError(onError, "missing tagged union option and value", metaData.range)
                        }
                        pop(metaData.range)
                        wrapupValue(metaData.range)
                        break
                    }
                    default:
                        assertUnreachable(currentContext[0])
                }
            }
        },
        onOpenTaggedUnion: metaData => {
            lineIsDirty = true
            if (DEBUG) { console.log("on open tagged union") }
            stack.push(currentContext)
            currentContext = ["taggedunion", {
                state: ["expecting option", {
                    handler: initValueHandler().taggedUnion(
                        metaData,
                        flushPreData(),
                    ),
                }],
            }]
        },
        onOpenObject: metaData => {
            lineIsDirty = true
            if (DEBUG) { console.log("on open object") }
            const vh = initValueHandler()
            const objectHandler = vh.object(
                metaData,
                flushPreData()
            )
            stack.push(currentContext)
            currentContext = ["object", {
                objectHandler: objectHandler,
                propertyHandler: null,
            }]
        },
        onCloseObject: metaData => {
            if (DEBUG) { console.log("on close object") }
            lineIsDirty = true
            unwindLoop: while (true) {
                switch (currentContext[0]) {
                    case "array": {
                        //const $ = currentContext[1]
                        raiseError(onError, "missing array close", metaData.range)
                        pop(metaData.range)
                        wrapupValue(metaData.range)
                        break
                    }
                    case "object": {
                        const $ = currentContext[1]
                        if ($.propertyHandler !== null) {
                            //was in the middle of processing a property
                            //the key was parsed, but the data was not
                            $.propertyHandler.onMissing()
                            $.propertyHandler = null
                        }
                        currentContext[1].objectHandler.end(
                            metaData,
                            flushPreData()
                        )
                        pop(metaData.range)
                        wrapupValue(metaData.range)
                        break unwindLoop
                    }
                    case "root": {
                        //const $ = currentContext[1]
                        raiseError(onError, "unexpected end of object", metaData.range)

                        break unwindLoop
                    }
                    case "taggedunion": {
                        //const $ = currentContext[1]
                        if (currentContext[1].state[0] === "expecting value") {
                            currentContext[1].state[1].onMissing()
                            raiseError(onError, "missing tagged union value", metaData.range)
                        } else {
                            raiseError(onError, "missing tagged union option and value", metaData.range)
                        }
                        pop(metaData.range)
                        wrapupValue(metaData.range)
                        break
                    }
                    default:
                        assertUnreachable(currentContext[0])
                }
            }

        },
        onString: (value, metaData) => {
            lineIsDirty = true
            function onSimpleValue(vh: ValueHandler) {
                if (DEBUG) { console.log("on simple value", value) }
                vh.simpleValue(
                    value,
                    metaData,
                    flushPreData()
                )
                wrapupValue(metaData.range)
            }
            switch (currentContext[0]) {
                case "array": {
                    const $ = currentContext[1]
                    onSimpleValue($.arrayHandler.element())
                    break
                }
                case "object": {
                    const $ = currentContext[1]
                    if ($.propertyHandler === null) {
                        if (DEBUG) { console.log("on key", value) }
                        if (currentContext[0] !== "object") {
                            raiseError(onError, "unexpected key", metaData.range)
                        } else {
                            currentContext[1].propertyHandler = currentContext[1].objectHandler.property(
                                value,
                                {
                                    keyRange: metaData.range,
                                },
                                flushPreData()
                            )
                        }
                    } else {
                        onSimpleValue($.propertyHandler.valueHandler)
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
                    const $ = currentContext[1]
                    switch ($.state[0]) {
                        case "expecting option": {
                            const $$ = $.state[1]
                            if (DEBUG) { console.log("on option", value) }
                            const rvh = $$.handler.option(
                                value,
                                {
                                    range: metaData.range,
                                    pauser: metaData.pauser,
                                },
                                flushPreData()
                            )
                            $.state = ["expecting value", rvh]
                            break
                        }
                        case "expecting value": {
                            const $$ = $.state[1]
                            onSimpleValue($$.valueHandler)

                            break
                        }
                        default:
                            assertUnreachable($.state[0])
                    }
                    break
                }
                default:
                    return assertUnreachable(currentContext[0])
            }
        },
        onEnd: (location: Location) => {
            const range = { start: location, end: location }
            unfoldLoop:
            while (true) {
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
                        break unfoldLoop
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
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}