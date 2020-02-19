/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
*/
import { DataSubscriber } from "./Parser"
import { Location, Range } from "./location"
import * as Char from "./NumberCharacters"
import { createDummyValueHandler } from "./dummyHandlers"

const DEBUG = false

/**
 * createStackedDataSubscriber allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */
export function createStackedDataSubscriber(
    valueHandler: ValueHandler,
    onRangeError: (message: string, range: Range) => void,
    onLocationError: (message: string, location: Location) => void,
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
            onRangeError("lost context", range)
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
                    onRangeError("unexpected value in object", range)
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
                    onRangeError("unexpected value in tagged union", range)
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
                onRangeError("unexpected end of array", range)
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
                onRangeError("unexpected option", range)
            } else {
                currentContext[1].valueHandler = currentContext[1].parentValueHandler.taggedUnion(option, currentContext[1].start, range, flushComments())
            }
        },
        onclosetaggedunion: location => {
            if (DEBUG) { console.log("on close tagged union") }
            if (currentContext[0] !== "taggedunion") {
                onLocationError("unexpected end of tagged union", location)
            }
            pop({ start: location, end: location })
        },
        onopenobject: (range, openCharacter) => {
            if (DEBUG) { console.log("on open object") }
            const vh = initValueHandler(range)
            if (vh === null) {
                onRangeError("unexpected value", range)
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
                onRangeError("unexpected end of object", range)
            } else {
                currentContext[1].objectHandler.end(range, endCharacter, flushComments())
            }
            pop(range)
        },
        onkey: (key, range) => {
            if (DEBUG) { console.log("on key", key) }
            if (currentContext[0] !== "object") {
                onRangeError("unexpected key", range)
            } else {
                currentContext[1].valueHandler = currentContext[1].objectHandler.property(key, range, flushComments())
            }
        },
        onquotedstring: (value, _quote, range) => {
            if (DEBUG) { console.log("on quoted string", value) }
            const vh = initValueHandler(range)
            if (vh === null) {
                onRangeError("unexpected value", range)
            }
            vh.string(value, range, flushComments())

        },
        onunquotedtoken: (value, range) => {
            if (DEBUG) { console.log("on value", value) }
            const vh = initValueHandler(range)
            if (vh === null) {
                onRangeError("unexpected value", range)
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
                    onRangeError(`invalid number: ${value}`, range)
                }
                vh.number(nr, range, flushComments())
                return
            }
            onRangeError(`unrecognized unquoted token '${value}'`, range)
        },
        onend: () => {
            onend(flushComments())
        },
    }
}

export type ObjectHandler = {
    property: (key: string, keyRange: Range, comments: Comment[]) => ValueHandler
    end: (end: Range, closeCharacter: string, comments: Comment[]) => void
}

export type ArrayHandler = {
    element: (start: Range, comments: Comment[]) => ValueHandler
    end: (end: Range, closeCharacter: string, comments: Comment[]) => void
}

export type OnObject = (start: Range, openCharacter: string, comments: Comment[]) => ObjectHandler
export type OnArray = (start: Range, openCharacter: string, comments: Comment[]) => ArrayHandler
export type OnNumber = (value: number, range: Range, comments: Comment[]) => void
export type OnBoolean = (value: boolean, range: Range, comments: Comment[]) => void
export type OnString = (value: string, range: Range, comments: Comment[]) => void
export type OnNull = (range: Range, comments: Comment[]) => void
export type OnTaggedUnion = (option: string, start: Range, optionRange: Range, comments: Comment[]) => ValueHandler

export interface ValueHandler {
    object: OnObject
    array: OnArray
    boolean: OnBoolean
    string: OnString
    number: OnNumber
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
        readonly start: Range
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