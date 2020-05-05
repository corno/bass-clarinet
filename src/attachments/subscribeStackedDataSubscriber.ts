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

export type ContextType =
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
        readonly taggedUnionHandler: TaggedUnionHandler
        readonly onMissingOption: () => void
        dataHandler: RequiredValueHandler | null //if null, the option still needs to be parsed
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
                currentContext[1].rootValueHandler = null
                if (vh === null) {
                    //expected end of document
                    //error is already reported by parser
                    return createDummyValueHandler()

                }
                return vh.valueHandler
            }
            case "taggedunion": {
                if (currentContext[1].dataHandler === null) {
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return currentContext[1].dataHandler.valueHandler
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
                onend(flushPreData())
                break
            }
            case "taggedunion": {
                if (currentContext[1].dataHandler === null) {
                    //error is already reported by parser
                    break
                } else {
                    pop(range)
                    wrapupValue(range)
                    break
                }
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
        onLineComment: (comment, range) => {
            lineIsDirty = true
            comments.push({
                text: comment,
                type: "line",
                indent: null,
                range: range,
            })
        },
        onBlockComment: (comment, range) => {
            lineIsDirty = true
            comments.push({
                text: comment,
                type: "line",
                indent: null, //FIX get the right indent info
                range: range,
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
            if (currentContext[0] !== "array") {
                raiseError(onError, "unexpected end of array", metaData.range)
            } else {
                currentContext[1].arrayHandler.end(
                    metaData,
                    flushPreData()
                )
                pop(metaData.range)
                wrapupValue(metaData.range)
            }
        },
        onOpenTaggedUnion: (range, pauser) => {
            lineIsDirty = true
            if (DEBUG) { console.log("on open tagged union") }
            stack.push(currentContext)
            currentContext = ["taggedunion", {
                taggedUnionHandler: initValueHandler().taggedUnion(
                    {
                        startRange: range,
                        pauser: pauser,
                    },
                    flushPreData(),
                ),
                onMissingOption: () => {
                    console.error("IMPLEMENT MISSING OPTION")
                },
                dataHandler: null,
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
            if (currentContext[0] !== "object") {
                raiseError(onError, "unexpected end of object", metaData.range)
            } else {
                if (currentContext[1].propertyHandler !== null) {
                    //was in the middle of processing a property
                    //the key was parsed, but the data was not
                    currentContext[1].propertyHandler.onMissing()
                }
                currentContext[1].objectHandler.end(
                    metaData,
                    flushPreData()
                )
                pop(metaData.range)
                wrapupValue(metaData.range)
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
                    if ($.dataHandler === null) {
                        if (DEBUG) { console.log("on option", value) }
                        if (currentContext[0] !== "taggedunion") {
                            raiseError(onError, "unexpected option", metaData.range)
                        } else {
                            currentContext[1].dataHandler = currentContext[1].taggedUnionHandler.option(
                                value,
                                {
                                    range: metaData.range,
                                    pauser: metaData.pauser,
                                },
                                flushPreData()
                            )
                        }
                    } else {
                        onSimpleValue($.dataHandler.valueHandler)
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
                        }
                        raiseError(onError, "unexpected end of document, still in object", range)
                        popStack()
                        break
                    }
                    case "taggedunion": {
                        const $ = currentContext[1]
                        if ($.dataHandler === null) {
                            //option not yet parsed
                            $.onMissingOption()
                        } else {
                            $.dataHandler.onMissing()
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