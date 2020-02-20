/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
*/
import { DataSubscriber } from "../Parser"
import { Location, Range } from "../location"
import * as Char from "../NumberCharacters"
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
 * createStackedDataSubscriber allows for capturing objects and arrays in a callback, so that the consumer does not have to match
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
        oncomma: () => {
            //
        },
        oncolon: () => {
            //
        },
        onlinecomment: (comment, range) => {
            comments.push({
                text: comment,
                type: "line",
                indent: null,
                range: range,
            })
        },
        onblockcomment: (comment, range, indent) => {
            comments.push({
                text: comment,
                type: "line",
                indent: indent,
                range: range,
            })
        },
        onopenarray: (range, openCHaracter) => {
            const arrayHandler = initValueHandler(range).array(range, openCHaracter, flushComments())
            stack.push(currentContext)
            currentContext = ["array", { arrayHandler: arrayHandler }]
        },
        onclosearray: (range, endCharacter) => {
            if (currentContext[0] !== "array") {
                raiseRangeError(onError, "unexpected end of array", range)
            } else {
                currentContext[1].arrayHandler.end(range, endCharacter, flushComments())
            }
            pop(range)
        },
        onopentaggedunion: range => {
            if (DEBUG) { console.log("on open tagged union") }
            stack.push(currentContext)
            currentContext = ["taggedunion", { start: range, parentValueHandler: initValueHandler(range), valueHandler: null }]
        },
        onoption: (option, range) => {
            if (DEBUG) { console.log("on option", option) }
            if (currentContext[0] !== "taggedunion") {
                raiseRangeError(onError, "unexpected option", range)
            } else {
                currentContext[1].valueHandler = currentContext[1].parentValueHandler.taggedUnion(option, currentContext[1].start, range, flushComments())
            }
        },
        onclosetaggedunion: location => {
            if (DEBUG) { console.log("on close tagged union") }
            if (currentContext[0] !== "taggedunion") {
                raiseLocationError(onError, "unexpected end of tagged union", location)
            }
            pop({ start: location, end: location })
        },
        onopenobject: (range, openCharacter) => {
            if (DEBUG) { console.log("on open object") }
            const vh = initValueHandler(range)
            if (vh === null) {
                raiseRangeError(onError, "unexpected value", range)
            }
            const objectHandler = vh.object(range, openCharacter, flushComments())
            stack.push(currentContext)
            currentContext = ["object", {
                objectHandler: objectHandler,
                valueHandler: null,
            }]
        },
        oncloseobject: (range, endCharacter) => {
            if (DEBUG) { console.log("on close object") }
            if (currentContext[0] !== "object") {
                raiseRangeError(onError, "unexpected end of object", range)
            } else {
                currentContext[1].objectHandler.end(range, endCharacter, flushComments())
            }
            pop(range)
        },
        onkey: (key, range) => {
            if (DEBUG) { console.log("on key", key) }
            if (currentContext[0] !== "object") {
                raiseRangeError(onError, "unexpected key", range)
            } else {
                currentContext[1].valueHandler = currentContext[1].objectHandler.property(key, range, flushComments())
            }
        },
        onquotedstring: (value, _quote, range) => {
            if (DEBUG) { console.log("on quoted string", value) }
            const vh = initValueHandler(range)
            if (vh === null) {
                raiseRangeError(onError, "unexpected value", range)
            }
            vh.string(value, range, flushComments())

        },
        onunquotedtoken: (value, range) => {
            if (DEBUG) { console.log("on value", value) }
            const vh = initValueHandler(range)
            if (vh === null) {
                raiseRangeError(onError, "unexpected value", range)
            }
            switch (value) {
                case "true": {
                    vh.boolean(true, range, flushComments())
                    return
                }
                case "false": {
                    vh.boolean(false, range, flushComments())
                    return
                }
                case "null": {
                    vh.null(range, flushComments())
                    return
                }
            }
            const curChar = value.charCodeAt(0)
            if (curChar === Char.Number.minus || Char.Number._0 <= curChar && curChar <= Char.Number._9) {
                //eslint-disable-next-line
                const nr = new Number(value).valueOf()
                if (isNaN(nr)) {
                    raiseRangeError(onError, `invalid number: ${value}`, range)
                }
                vh.number(nr, range, flushComments())
                return
            }
            raiseRangeError(onError, `unrecognized unquoted token '${value}'`, range)
        },
        onend: () => {
            onend(flushComments())
        },
    }
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}