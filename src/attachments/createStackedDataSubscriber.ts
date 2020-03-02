/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
*/
import { DataSubscriber, SimpleValueRole } from "../Parser"
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
): DataSubscriber {
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
    function initValueHandler(range: Range): ValueHandler {
        switch (currentContext[0]) {
            case "array": {
                return currentContext[1].arrayHandler.element(range, flushComments())
            }
            case "object": {
                if (currentContext[1].valueHandler === null) {
                    raiseRangeError(onError, "unexpected value in object", range)
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
                    raiseRangeError(onError, "unexpected value in tagged union", range)
                    return createDummyValueHandler()
                } else {
                    return currentContext[1].valueHandler
                }
            }
            default:
                return assertUnreachable(currentContext[0])
        }
    }

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
        onOpenArray: (range, openCHaracter, pauser) => {
            const arrayHandler = initValueHandler(range).array(range, openCHaracter, flushComments(), pauser)
            stack.push(currentContext)
            currentContext = ["array", { arrayHandler: arrayHandler }]
        },
        onCloseArray: (range, endCharacter) => {
            if (currentContext[0] !== "array") {
                raiseRangeError(onError, "unexpected end of array", range)
            } else {
                currentContext[1].arrayHandler.end(range, endCharacter, flushComments())
            }
            pop(range)
        },
        onOpenTaggedUnion: range => {
            if (DEBUG) { console.log("on open tagged union") }
            stack.push(currentContext)
            currentContext = ["taggedunion", { start: range, parentValueHandler: initValueHandler(range), valueHandler: null, comments: flushComments() }]
        },
        onCloseTaggedUnion: location => {
            if (DEBUG) { console.log("on close tagged union") }
            if (currentContext[0] !== "taggedunion") {
                raiseLocationError(onError, "unexpected end of tagged union", location)
            }
            pop({ start: location, end: location })
        },
        onOpenObject: (range, openCharacter, pauser) => {

            if (DEBUG) { console.log("on open object") }
            const vh = initValueHandler(range)
            if (vh === null) {
                raiseRangeError(onError, "unexpected value", range)
            }
            const objectHandler = vh.object(range, openCharacter, flushComments(), pauser)
            stack.push(currentContext)
            currentContext = ["object", {
                objectHandler: objectHandler,
                valueHandler: null,
            }]
        },
        onCloseObject: (range, endCharacter) => {

            if (DEBUG) { console.log("on close object") }
            if (currentContext[0] !== "object") {
                raiseRangeError(onError, "unexpected end of object", range)
            } else {
                currentContext[1].objectHandler.end(range, endCharacter, flushComments())
            }
            pop(range)
        },
        onQuotedString: (value, role, _quote, range, _terminated, pauser) => {
            switch (role) {
                case SimpleValueRole.KEY: {
                    if (DEBUG) { console.log("on key", value) }
                    if (currentContext[0] !== "object") {
                        raiseRangeError(onError, "unexpected key", range)
                    } else {
                        currentContext[1].valueHandler = currentContext[1].objectHandler.property(value, range, flushComments())
                    }
                    break
                }
                case SimpleValueRole.OPTION: {
                    if (DEBUG) { console.log("on option", value) }
                    if (currentContext[0] !== "taggedunion") {
                        raiseRangeError(onError, "unexpected option", range)
                    } else {
                        currentContext[1].valueHandler = currentContext[1].parentValueHandler.taggedUnion(value, currentContext[1].start, currentContext[1].comments, range, flushComments(), pauser)
                    }
                    break
                }
                case SimpleValueRole.VALUE: {

                    if (DEBUG) { console.log("on quoted string", value) }
                    const vh = initValueHandler(range)
                    if (vh === null) {
                        raiseRangeError(onError, "unexpected value", range)
                    }
                    vh.quotedString(value, range, flushComments(), pauser)
                    break
                }
                default:
                    return assertUnreachable(role)
            }
        },
        onUnquotedToken: (value, range, pauser) => {
            if (DEBUG) { console.log("on value", value) }
            const vh = initValueHandler(range)
            if (vh === null) {
                raiseRangeError(onError, "unexpected value", range)
            }
            vh.unquotedToken(value, range, flushComments(), pauser)
        },
        onEnd: () => {
            onend(flushComments())
        },
    }
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}