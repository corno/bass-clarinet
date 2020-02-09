import { Parser } from "./Parser";
import { Location, Range } from "./location"

const DEBUG = false

/**
 * subscribeStack allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */

export function subscribeStackWithSchema(p: Parser, onReference: (schemaReference: string, startLocation: Location, range: Range) => ValueHandler, onError: (err: Error) => void) {

    let foundSchemaReference = false

    p.onschemareference.subscribe((schemaReference, startLocation, range) => {
        foundSchemaReference = true
        const vh = onReference(schemaReference, startLocation, range)
        subscribeStack(p, vh, onError)
    })
    p.onend.subscribe(() => {
        if (!foundSchemaReference) {
            throw new Error("no schema found")
        }
    })
}

export function subscribeStack(p: Parser, rootHandler: ValueHandler, onError: (error: Error) => void) {
    const stack: Array<ContextType> = []

    let currentContext: ContextType = ["root", { valueHandler: rootHandler }]

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
                return currentContext[1].arrayHandler.element(location)
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

    p.onopenarray.subscribe((location, openCHaracter) => {
        const arrayHandler = initValueHandler(location).array(location, openCHaracter)
        stack.push(currentContext)
        currentContext = ["array", { arrayHandler: arrayHandler}]
    })
    p.onclosearray.subscribe((location, endCharacter) => {
        if (currentContext[0] !== "array") {
            throw new Error("stack panic; unexpected end of array")
        } else {
            currentContext[1].arrayHandler.end(location, endCharacter)
        }
        pop()
    })

    p.onopentypedunion.subscribe(location => {
        if (DEBUG) { console.log("on open typed union")}
        stack.push(currentContext)
        currentContext = ["typedunion", { location: location, parentValueHandler: initValueHandler(location), valueHandler: null }]
    })
    p.onoption.subscribe((option, range) => {
        if (DEBUG) { console.log("on option", option)}
        if (currentContext[0] !== "typedunion") {
            throw new Error("stack panic; unexpected option")
        }
        currentContext[1].valueHandler = currentContext[1].parentValueHandler.typedunion(option, currentContext[1].location, range)
    })
    p.onclosetypedunion.subscribe(() => {
        if (DEBUG) { console.log("on close typed union")}
        if (currentContext[0] !== "typedunion") {
            throw new Error("stack panic; unexpected end of typed union")
        }
        pop()
    })

    p.onopenobject.subscribe((location, openCharacter) => {
        if (DEBUG) { console.log("on open object")}
        const vh = initValueHandler(location)
        if (vh === null) {
            throw new Error("stack panic; unexpected value")
        }
        const objectHandler = vh.object(location, openCharacter)
        stack.push(currentContext)
        currentContext = ["object", {
            objectHandler: objectHandler,
            valueHandler: null
        }]
    })
    p.oncloseobject.subscribe((location, endCharacter) => {
        if (DEBUG) { console.log("on close object")}
        if (currentContext[0] !== "object") {
            throw new Error("stack panic; unexpected end of object")
        }
        currentContext[1].objectHandler.end(location, endCharacter)
        pop()
    })
    p.onkey.subscribe((key, range) => {
        if (DEBUG) { console.log("on key", key)}
        if (currentContext[0] !== "object") {
            throw new Error("stack panic; unexpected key")
        }
        currentContext[1].valueHandler = currentContext[1].objectHandler.property(key, range)
    })

    p.onsimplevalue.subscribe((value, range) => {
        if (DEBUG) { console.log("on value", value)}
        const vh = initValueHandler(range.start)
        if (vh === null) {
            throw new Error("stack panic; unexpected value")
        }
        vh.value(value, range)
    })
}

export type ObjectHandler = {
    property: (key: string, keyRange: Range) => ValueHandler
    end: (endLocation: Location, closeCharacter: string) => void
}

export type ArrayHandler = {
    element: (startLocation: Location) => ValueHandler
    end: (endLocation: Location, closeCharacter: string) => void
}

export type TypedUnionHandler = {
    data: () => ValueHandler
}

export interface ValueHandler {
    object: (startLocation: Location, openCharacter: string) => ObjectHandler
    array: (startLocation: Location, openCharacter: string) => ArrayHandler
    value: (value: number | string | boolean | null, range: Range) => void
    typedunion: (option: string, startLocation: Location, optionRange: Range) => ValueHandler
}

type ContextType =
    | ["root", { valueHandler: ValueHandler }]
    | ["object", { objectHandler: ObjectHandler, valueHandler: null | ValueHandler }]
    | ["array", { arrayHandler : ArrayHandler }]
    | ["typedunion", { location: Location, parentValueHandler: ValueHandler, valueHandler: null | ValueHandler }]

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}