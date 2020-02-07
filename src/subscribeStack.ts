import { Parser } from "./Parser";
import { Range, Location } from "./parserTypes"

/**
 * subscribeStack allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */

export function subscribeStack(p: Parser, rootSubscribers: ValueSubscribers) {
    const stack: Array<ContextType> = []
    let currentContext: ContextType = ["root", { rootSubscribers: rootSubscribers, schemaReference: null, schemaReferenceRange: null }]
    
    p.onschemareference.subscribe((key, range) => {
        if (currentContext[0] !== "root") {
            throw new Error("unexpected key")
        }
        currentContext[1].schemaReference = key
        currentContext[1].schemaReferenceRange = range
    })

    p.onopenarray.subscribe(location => {
        const ac1: ArrayContext1 = {
            elementSubscribers: [],
            endSubscribers: []
        }
        const ac = new ArrayContext(ac1, location)
        switch (currentContext[0]) {
            case "array":
                currentContext[1].elementSubscribers.forEach(s => { if (s.array) s.array(ac) })
                break
            case "object":
                const $ = currentContext[1]
                currentContext[1].propertySubscribers.forEach(s => { if (s.array) s.array($.currentKey, ac, $.currentKeyRange!) })
                break
            case "root":
                if (currentContext[1].rootSubscribers.array) {
                    currentContext[1].rootSubscribers.array(ac)
                }
                break
            default: assertUnreachable(currentContext[0])
        }
        stack.push(currentContext)
        currentContext = ["array", ac1]
    })
    p.onclosearray.subscribe(location => {
        if (currentContext[0] !== "array") {
            throw new Error("unexpected onclosearray")
        }
        currentContext[1].endSubscribers.forEach(s => s(location))
        const previous = stack.pop()
        if (previous === undefined) {
            throw new Error("stack panic")
        }
        currentContext = previous
    })

    p.onopentypedunion.subscribe(() => {
        throw new Error("IMPLEMENT ME")
    })
    p.onclosetypedunion.subscribe(() => {
        throw new Error("IMPLEMENT ME")
    })
    p.onoption.subscribe(() => {
        throw new Error("IMPLEMENT ME")
    })
    
    p.onopenobject.subscribe(location => {
        const oc1: ObjectContext1 = {
            propertySubscribers: [],
            endSubscribers: [],
            currentKey: "",
            currentKeyRange: null
        }
        const oc = new ObjectContext(oc1, location)
        switch (currentContext[0]) {
            case "array":
                currentContext[1].elementSubscribers.forEach(s => { if (s.object) s.object(oc) })
                break
            case "object":
                const $ = currentContext[1]
                currentContext[1].propertySubscribers.forEach(s => { if (s.object) s.object($.currentKey, oc, $.currentKeyRange!) })
                break
            case "root":
                if (currentContext[1].rootSubscribers.object) {
                    currentContext[1].rootSubscribers.object(oc)
                }
                break
            default: assertUnreachable(currentContext[0])
        }
        stack.push(currentContext)
        currentContext = ["object", oc1]

    })
    p.oncloseobject.subscribe(location => {
        if (currentContext[0] !== "object") {
            throw new Error("unexpected oncloseobject")
        }
        currentContext[1].endSubscribers.forEach(s => s(location))
        const previous = stack.pop()
        if (previous === undefined) {
            throw new Error("stack panic")
        }
        currentContext = previous
    })
    p.onkey.subscribe((key, range) => {
        if (currentContext[0] !== "object") {
            throw new Error("unexpected key")
        }
        currentContext[1].currentKey = key
        currentContext[1].currentKeyRange = range
    })

    p.onvalue.subscribe((value, range) => {
        switch (currentContext[0]) {
            case "array": {
                const $ = currentContext[1]
                $.elementSubscribers.forEach(s => {
                    if (s.value) {
                        s.value(value, range)
                    }
                })
                break
            }
            case "object": {
                const $ = currentContext[1]
                $.propertySubscribers.forEach(s => {
                    if (s.value) {
                        s.value($.currentKey, value, range, $.currentKeyRange!)
                    }
                })
                break
            }
            case "root": {
                const $ = currentContext[1]
                if ($.rootSubscribers.value) {
                    $.rootSubscribers.value(value, range)
                }
                break
            }
            default: assertUnreachable(currentContext[0])
        }
    })
}

type ObjectContext1 = {
    propertySubscribers: Array<PropertySubscribers>
    endSubscribers: Array<(end: Location) => void>
    currentKey: string
    currentKeyRange: null | Range
}


export class ObjectContext {
    private oc: ObjectContext1
    readonly start: Location
    constructor(oc: ObjectContext1, start: Location) {
        this.oc = oc
        this.start = start
    }
    onProperty(propertySubscribers: PropertySubscribers): void {
        this.oc.propertySubscribers.push(propertySubscribers)
    }
    onEnd(subscriber: (end: Location) => void): void {
        this.oc.endSubscribers.push(subscriber)
    }
}

type ArrayContext1 = {
    elementSubscribers: Array<ValueSubscribers>
    endSubscribers: Array<(end: Location) => void>
}

export class ArrayContext {
    readonly start: Location
    private readonly ac: ArrayContext1
    constructor(ac: ArrayContext1, start: Location) {
        this.ac = ac
        this.start = start
    }
    onElement(subscribers: ValueSubscribers): void {
        this.ac.elementSubscribers.push(subscribers)
    }
    onEnd(subscriber: (end: Location) => void): void {
        this.ac.endSubscribers.push(subscriber)
    }
}

export type ValueSubscribers = {
    object?: (objectContext: ObjectContext) => void
    array?: (arrayContext: ArrayContext) => void
    value?: (value: number | string | boolean | null, range: Range) => void
}

export type PropertySubscribers = {
    object?: (key: string, objectContext: ObjectContext, keyRange: Range) => void
    array?: (key: string, arrayContext: ArrayContext, keyRange: Range) => void
    value?: (key: string, value: number | string | boolean | null, range: Range, keyRange: Range) => void
}

type RootContext1 = {
    rootSubscribers: ValueSubscribers
    schemaReference: null | string
    schemaReferenceRange: null | Range

}

type ContextType =
    | ["root", RootContext1]
    | ["object", ObjectContext1]
    | ["array", ArrayContext1]

function assertUnreachable(_x: never) {
    throw new Error("unreachable")
}