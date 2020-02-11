import { Parser, Error } from "./Parser";
import { Location, Range } from "./location"

const DEBUG = false

/**
 * subscribeStack allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */

export function subscribeStackWithSchema(
    p: Parser,
    onReference: (schemaReference: string, startLocation: Location, range: Range) => RootHandler,
    onError: (err: Error) => void
) {

    let foundSchemaReference = false

    p.onheaderdata.subscribe({
        onschemareference: (schemaReference, startLocation, range) => {
            foundSchemaReference = true
            const vh = onReference(schemaReference, startLocation, range)
            subscribeStack(p, vh, onError)
        },
        oncompact: () => { }
    })

    p.onend.subscribe(() => {
        if (!foundSchemaReference) {
            throw new Error("no schema found")
        }
    })
}

type Comment = {
    text: string
    range: Range
    type:
    | "block"
    | "line"
    indent: null | string
}

export function subscribeStack(p: Parser, rootHandler: RootHandler, onError: (error: Error) => void) {
    const stack: Array<ContextType> = []
    let comments: Comment[] = []

    let currentContext: ContextType = ["root", { valueHandler: rootHandler.value }]

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
            case "typedunion": {
                if (currentContext[1].valueHandler === null) {
                    throw new Error("stack panic; unexpected value in typed union")
                }
                return currentContext[1].valueHandler
            }
            default:
                return assertUnreachable(currentContext[0])
        }
    }
    p.onerror.subscribe(err => onError(err))

    p.onend.subscribe(() => {
        rootHandler.endComments(flushComments())
    })

    p.ondata.subscribe({
        onlinecomment: (comment, range) => {
            comments.push({
                text: comment,
                type: "line",
                indent: null,
                range: range
            })
        },
        onblockcomment: (comment, indent, range) => {
            comments.push({
                text: comment,
                type: "line",
                indent: indent,
                range: range
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
        onopentypedunion: location => {
            if (DEBUG) { console.log("on open typed union") }
            stack.push(currentContext)
            currentContext = ["typedunion", { location: location, parentValueHandler: initValueHandler(location), valueHandler: null }]
        },
        onoption: (option, range) => {
            if (DEBUG) { console.log("on option", option) }
            if (currentContext[0] !== "typedunion") {
                throw new Error("stack panic; unexpected option")
            }
            currentContext[1].valueHandler = currentContext[1].parentValueHandler.typedUnion(option, currentContext[1].location, range, flushComments())
        },
        onclosetypedunion: () => {
            if (DEBUG) { console.log("on close typed union") }
            if (currentContext[0] !== "typedunion") {
                throw new Error("stack panic; unexpected end of typed union")
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
                valueHandler: null
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
        onsimplevalue: (value, range) => {
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
        }
    })
}

export type ObjectHandler = {
    property: (key: string, keyRange: Range, comments: Comment[]) => ValueHandler
    end: (endLocation: Location, closeCharacter: string, comments: Comment[]) => void
}

export type ArrayHandler = {
    element: (startLocation: Location, comments: Comment[]) => ValueHandler
    end: (endLocation: Location, closeCharacter: string, comments: Comment[]) => void
}

export interface ValueHandler {
    object: (startLocation: Location, openCharacter: string, comments: Comment[]) => ObjectHandler
    array: (startLocation: Location, openCharacter: string, comments: Comment[]) => ArrayHandler
    simpleValue: (value: number | string | boolean, range: Range, comments: Comment[]) => void
    null: (range: Range, comments: Comment[]) => void
    typedUnion: (option: string, startLocation: Location, optionRange: Range, comments: Comment[]) => ValueHandler
}

export interface RootHandler {
    value: ValueHandler
    endComments: (comments: Comment[]) => void
}

type ContextType =
    | ["root", { valueHandler: ValueHandler }]
    | ["object", { objectHandler: ObjectHandler, valueHandler: null | ValueHandler }]
    | ["array", { arrayHandler: ArrayHandler }]
    | ["typedunion", { location: Location, parentValueHandler: ValueHandler, valueHandler: null | ValueHandler }]

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}