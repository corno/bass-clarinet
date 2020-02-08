import { Parser } from "./Parser";
import { Range, Location } from "./parserTypes"

/**
 * subscribeStack allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */

export function subscribeStackWithSchema(p: Parser, onReference: (schemaReference: string, startLocation: Location, range: Range) => ValueHandler) {

    let foundSchemaReference = false

    p.onschemareference.subscribe((schemaReference, startLocation, range) => {
        foundSchemaReference = true
        const vh = onReference(schemaReference, startLocation, range)
        subscribeStack(p, vh)
    })
    p.onend.subscribe(() => {
        if (!foundSchemaReference) {
            throw new Error("no schema found")
        }
    })
}

export function subscribeStack(p: Parser, rootHandler: ValueHandler) {
    const stack: Array<ContextType> = []

    let currentContext: ContextType = ["root", { valueHandler: rootHandler }]

    function pop() {
        const previousContext = stack.pop()
        if (previousContext === undefined) {
            throw new Error("stack panic")
        }
        // switch (previousContext[0]) {
        //     case "array": {
        //         break
        //     }
        //     case "object": {
        //         break
        //     }
        //     case "root": {
        //         break
        //     }
        //     case "typedunion": {
        //         break
        //     }
        //     default:
        //         return assertUnreachable(previousContext[0])
        // }
        currentContext = previousContext
    }
    function getValueHandler(): ValueHandler {
        switch (currentContext[0]) {
            case "array": {
                return currentContext[1].arrayHandler.element()
            }
            case "object": {
                if (currentContext[1].valueHandler === null) {
                    throw new Error("unexpected value in object")
                }
                return currentContext[1].valueHandler
            }
            case "root": {
                return currentContext[1].valueHandler
            }
            case "typedunion": {
                if (currentContext[1].valueHandler === null) {
                    throw new Error("unexpected value in typed union")
                }
                return currentContext[1].valueHandler
            }
            default:
                return assertUnreachable(currentContext[0])
        }
    }

    p.onopenarray.subscribe(location => {
        const arrayHandler = getValueHandler().array(location)
        stack.push(currentContext)
        currentContext = ["array", { arrayHandler: arrayHandler}]
    })
    p.onclosearray.subscribe(location => {
        if (currentContext[0] !== "array") {
            throw new Error("unexpected end of array")
        } else {
            currentContext[1].arrayHandler.end(location)
        }
        pop()
    })

    p.onopentypedunion.subscribe(location => {
        if (getValueHandler() === null) {
            throw new Error("unexpected value")
        }
        stack.push(currentContext)
        currentContext = ["typedunion", { location: location, valueHandler: null }]
    })
    p.onclosetypedunion.subscribe(() => {
        if (currentContext[0] !== "typedunion") {
            throw new Error("unexpected end of typed union")
        }
        pop()
    })
    p.onoption.subscribe((option, range) => {
        if (getValueHandler() === null) {
            throw new Error("unexpected option")
        }
        if (currentContext[0] !== "typedunion") {
            throw new Error("unexpected option")
        }
        currentContext[1].valueHandler = getValueHandler().typedunion(option, currentContext[1].location, range)
    })

    p.onopenobject.subscribe(location => {
        if (getValueHandler() === null) {
            throw new Error("unexpected value")
        }
        const objectHandler = getValueHandler().object(location)
        stack.push(currentContext)
        currentContext = ["object", {
            objectHandler: objectHandler,
            valueHandler: null
        }]
    })
    p.oncloseobject.subscribe(location => {
        if (currentContext[0] !== "object") {
            throw new Error("unexpected end of object")
        }
        currentContext[1].objectHandler.end(location)
        pop()
    })
    p.onkey.subscribe((key, range) => {
        if (currentContext[0] !== "object") {
            throw new Error("unexpected key")
        }
        currentContext[1].valueHandler = currentContext[1].objectHandler.property(key, range)
    })

    p.onvalue.subscribe((value, range) => {
        if (getValueHandler() === null) {
            throw new Error("unexpected value")
        }
        getValueHandler().value(value, range)
    })
}

export type ObjectHandler = {
    property: (key: string, keyRange: Range) => ValueHandler
    end: (endLocation: Location) => void
}

export type ArrayHandler = {
    element: () => ValueHandler
    end: (endLocation: Location) => void
}

export type TypedUnionHandler = {
    data: () => ValueHandler
}

export interface ValueHandler {
    object: (startLocation: Location) => ObjectHandler
    array: (startLocation: Location) => ArrayHandler
    value: (value: number | string | boolean | null, range: Range) => void
    typedunion: (option: string, startLocation: Location, optionRange: Range) => ValueHandler
}

type ContextType =
    | ["root", { valueHandler: ValueHandler }]
    | ["object", { objectHandler: ObjectHandler, valueHandler: null | ValueHandler }]
    | ["array", { arrayHandler : ArrayHandler }]
    | ["typedunion", { location: Location, valueHandler: null | ValueHandler }]

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}