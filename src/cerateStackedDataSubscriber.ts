/* eslint
    no-console:"off",
*/
import { DataSubscriber } from "./Parser";
import { Location, Range } from "./location"

const DEBUG = false

/**
 * createStackedDataSubscriber allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */
export function createStackedDataSubscriber(valueHandler: ValueHandler, onend: (comments: Comment[]) => void): DataSubscriber {
    const stack: ContextType[] = []
    let comments: Comment[] = []

    let currentContext: ContextType = ["root", { valueHandler: valueHandler }]

    function flushComments() {
        const comm = comments
        comments = []
        return comm
    }

    function pop() {
        const previousContext = stack.pop()
        if (previousContext === undefined) {
            throw new Error("stack panic; lost context")
        }
        currentContext = previousContext
    }
    function initValueHandler(location: Location): ValueHandler {
        switch (currentContext[0]) {
            case "array": {
                return currentContext[1].arrayHandler.element(location, flushComments())
            }
            case "object": {
                if (currentContext[1].valueHandler === null) {
                    throw new Error("stack panic; unexpected value in object")
                }
                return currentContext[1].valueHandler
            }
            case "root": {
                return currentContext[1].valueHandler
            }
            case "taggedunion": {
                if (currentContext[1].valueHandler === null) {
                    throw new Error("stack panic; unexpected value in tagged union")
                }
                return currentContext[1].valueHandler
            }
            default:
                return assertUnreachable(currentContext[0])
        }
    }

    return {
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
        onopenarray: (location, openCHaracter) => {
            const arrayHandler = initValueHandler(location).array(location, openCHaracter, flushComments())
            stack.push(currentContext)
            currentContext = ["array", { arrayHandler: arrayHandler }]
        },
        onclosearray: (location, endCharacter) => {
            if (currentContext[0] !== "array") {
                throw new Error("stack panic; unexpected end of array")
            } else {
                currentContext[1].arrayHandler.end(location, endCharacter, flushComments())
            }
            pop()
        },
        onopentaggedunion: location => {
            if (DEBUG) { console.log("on open tagged union") }
            stack.push(currentContext)
            currentContext = ["taggedunion", { location: location, parentValueHandler: initValueHandler(location), valueHandler: null }]
        },
        onoption: (option, range) => {
            if (DEBUG) { console.log("on option", option) }
            if (currentContext[0] !== "taggedunion") {
                throw new Error("stack panic; unexpected option")
            }
            currentContext[1].valueHandler = currentContext[1].parentValueHandler.taggedUnion(option, currentContext[1].location, range, flushComments())
        },
        onclosetaggedunion: () => {
            if (DEBUG) { console.log("on close tagged union") }
            if (currentContext[0] !== "taggedunion") {
                throw new Error("stack panic; unexpected end of tagged union")
            }
            pop()
        },
        onopenobject: (location, openCharacter) => {
            if (DEBUG) { console.log("on open object") }
            const vh = initValueHandler(location)
            if (vh === null) {
                throw new Error("stack panic; unexpected value")
            }
            const objectHandler = vh.object(location, openCharacter, flushComments())
            stack.push(currentContext)
            currentContext = ["object", {
                objectHandler: objectHandler,
                valueHandler: null,
            }]
        },
        oncloseobject: (location, endCharacter) => {
            if (DEBUG) { console.log("on close object") }
            if (currentContext[0] !== "object") {
                throw new Error("stack panic; unexpected end of object")
            }
            currentContext[1].objectHandler.end(location, endCharacter, flushComments())
            pop()
        },
        onkey: (key, range) => {
            if (DEBUG) { console.log("on key", key) }
            if (currentContext[0] !== "object") {
                throw new Error("stack panic; unexpected key")
            }
            currentContext[1].valueHandler = currentContext[1].objectHandler.property(key, range, flushComments())
        },
        onquotedstring: (value, _quote, range) => {
            if (DEBUG) { console.log("on quoted string", value) }
            const vh = initValueHandler(range.start)
            if (vh === null) {
                throw new Error("stack panic; unexpected value")
            }
            vh.simpleValue(value, range, flushComments())

        },
        onunquotedstring: (value, range) => {
            if (DEBUG) { console.log("on value", value) }
            const vh = initValueHandler(range.start)
            if (vh === null) {
                throw new Error("stack panic; unexpected value")
            }
            switch (value) {
                case "true": {
                    vh.simpleValue(true, range, flushComments())
                    break
                }
                case "false": {
                    vh.simpleValue(false, range, flushComments())
                    break
                }
                case "null": {
                    vh.null(range, flushComments())
                    break
                }
                default:
                    throw new Error(`unknown keyword '${value}'`)
            }
        },
        onnumber: (value, range) => {
            if (DEBUG) { console.log("on value", value) }
            const vh = initValueHandler(range.start)
            if (vh === null) {
                throw new Error("stack panic; unexpected value")
            }
            if (value === null) {
                vh.null(range, flushComments())
            } else {
                vh.simpleValue(value, range, flushComments())
            }
        },
        onend: () => {
            onend(flushComments())
        },
    }
}

export type ObjectHandler = {
    property: (key: string, keyRange: Range, comments: Comment[]) => ValueHandler
    end: (endLocation: Location, closeCharacter: string, comments: Comment[]) => void
}

export type ArrayHandler = {
    element: (startLocation: Location, comments: Comment[]) => ValueHandler
    end: (endLocation: Location, closeCharacter: string, comments: Comment[]) => void
}

export type OnObject = (startLocation: Location, openCharacter: string, comments: Comment[]) => ObjectHandler
export type OnArray = (startLocation: Location, openCharacter: string, comments: Comment[]) => ArrayHandler
export type OnSimpleValue = (value: number | string | boolean, range: Range, comments: Comment[]) => void
export type OnNull = (range: Range, comments: Comment[]) => void
export type OnTaggedUnion = (option: string, startLocation: Location, optionRange: Range, comments: Comment[]) => ValueHandler

export interface ValueHandler {
    object: OnObject
    array: OnArray
    simpleValue: OnSimpleValue
    null: OnNull
    taggedUnion: OnTaggedUnion
}

type ContextType =
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
        readonly location: Location
        readonly parentValueHandler: ValueHandler
        valueHandler: null | ValueHandler
    }]

type Comment = {
    text: string
    range: Range
    type:
    | "block"
    | "line"
    indent: null | string
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}