/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
*/
import { IDataSubscriber, SimpleValueRole } from "../IDataSubscriber"
import { Location, Range } from "../location"
import { createDummyValueHandler } from "./dummyHandlers"
import { ValueHandler, ObjectHandler, ArrayHandler, Comment } from "./handlers"

const DEBUG = false


export type ContextType =
    | ["root", {
        readonly valueHandler: ValueHandler
    }]
    | ["object", {
        readonly objectHandler: ObjectHandler
        valueHandler: null | ValueHandler
    }]
    | ["array", {
        readonly arrayHandler: ArrayHandler
    }]
    | ["taggedunion", {
        readonly start: Range
        readonly parentValueHandler: ValueHandler
        valueHandler: null | ValueHandler
        comments: Comment[]
    }]

type StackedDataError = {
    message: string
    context:
    | ["range", Range]
    | ["location", Location]
}

function raiseRangeError(onError: (error: StackedDataError) => void, message: string, range: Range) {
    onError({
        message: message,
        context: ["range", range],
    })
}
function raiseLocationError(onError: (error: StackedDataError) => void, message: string, location: Location) {
    onError({
        message: message,
        context: ["location", location],
    })
}

/**
 * attachStackedDataSubscriber allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */
export function createStackedDataSubscriber(
    valueHandler: ValueHandler,
    onError: (error: StackedDataError) => void,
    onend: (comments: Comment[]) => void
): IDataSubscriber {
    const stack: ContextType[] = []
    let comments: Comment[] = []

    let currentContext: ContextType = ["root", { valueHandler: valueHandler }]

    function flushComments() {
        const comm = comments
        comments = []
        return comm
    }

    function pop(range: Range) {
        const previousContext = stack.pop()
        if (previousContext === undefined) {
            raiseRangeError(onError, "lost context", range)
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
                if (currentContext[1].valueHandler === null) {
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return currentContext[1].valueHandler
                }
            }
            case "root": {
                return currentContext[1].valueHandler
            }
            case "taggedunion": {
                if (currentContext[1].valueHandler === null) {
                    //error is already reported by parser
                    return createDummyValueHandler()
                } else {
                    return currentContext[1].valueHandler
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
            //
        },
        onColon: () => {
            //
        },
        onNewLine: () => {
            //
        },
        onWhitespace: () => {
            //
        },
        onLineComment: (comment, range) => {
            comments.push({
                text: comment,
                type: "line",
                indent: null,
                range: range,
            })
        },
        onBlockComment: (comment, range) => {
            comments.push({
                text: comment,
                type: "line",
                indent: null, //FIX get the right indent info
                range: range,
            })
        },
        onOpenArray: metaData => {
            const arrayHandler = initValueHandler().array(
                metaData,
                flushComments()
            )
            stack.push(currentContext)
            currentContext = ["array", { arrayHandler: arrayHandler }]
        },
        onCloseArray: metaData => {
            if (currentContext[0] !== "array") {
                raiseRangeError(onError, "unexpected end of array", metaData.range)
            } else {
                pop(metaData.range)
                currentContext[1].arrayHandler.end(
                    metaData,
                    flushComments()
                )
            }
        },
        onOpenTaggedUnion: range => {
            if (DEBUG) { console.log("on open tagged union") }
            stack.push(currentContext)
            currentContext = ["taggedunion", { start: range, parentValueHandler: initValueHandler(), valueHandler: null, comments: flushComments() }]
        },
        onCloseTaggedUnion: location => {
            if (DEBUG) { console.log("on close tagged union") }
            if (currentContext[0] !== "taggedunion") {
                raiseLocationError(onError, "unexpected end of tagged union", location)
            }
            pop({ start: location, end: location })
        },
        onOpenObject: metaData => {

            if (DEBUG) { console.log("on open object") }
            const vh = initValueHandler()
            const objectHandler = vh.object(
                metaData,
                flushComments()
            )
            stack.push(currentContext)
            currentContext = ["object", {
                objectHandler: objectHandler,
                valueHandler: null,
            }]
        },
        onCloseObject: metaData => {
            if (DEBUG) { console.log("on close object") }
            if (currentContext[0] !== "object") {
                raiseRangeError(onError, "unexpected end of object", metaData.range)
            } else {
                currentContext[1].objectHandler.end(
                    metaData,
                    flushComments()
                )
            }
            pop(metaData.range)
        },
        onQuotedString: (value, metaData) => {
            switch (metaData.role) {
                case SimpleValueRole.KEY: {
                    if (DEBUG) { console.log("on key", value) }
                    if (currentContext[0] !== "object") {
                        raiseRangeError(onError, "unexpected key", metaData.range)
                    } else {
                        currentContext[1].valueHandler = currentContext[1].objectHandler.property(
                            value,
                            {
                                keyRange: metaData.range,
                            },
                            flushComments()
                        )
                    }
                    break
                }
                case SimpleValueRole.OPTION: {
                    if (DEBUG) { console.log("on option", value) }
                    if (currentContext[0] !== "taggedunion") {
                        raiseRangeError(onError, "unexpected option", metaData.range)
                    } else {
                        currentContext[1].valueHandler = currentContext[1].parentValueHandler.taggedUnion(
                            value,
                            {
                                startRange: currentContext[1].start,
                                optionRange: metaData.range,
                                pauser: metaData.pauser,
                            },
                            currentContext[1].comments,
                            flushComments()
                        )
                    }
                    break
                }
                case SimpleValueRole.VALUE: {

                    if (DEBUG) { console.log("on quoted string", value) }
                    const vh = initValueHandler()
                    vh.simpleValue(
                        value,
                        metaData,
                        flushComments()
                    )
                    break
                }
                default:
                    return assertUnreachable(metaData.role)
            }
        },
        onUnquotedToken: (value, metaData) => {
            if (DEBUG) { console.log("on value", value) }
            const vh = initValueHandler()
            vh.simpleValue(
                value,
                metaData,
                flushComments()
            )
        },
        onEnd: () => {
            onend(flushComments())
        },
    }
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}