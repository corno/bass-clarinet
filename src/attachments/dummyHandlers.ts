import { ArrayHandler, ObjectHandler, ValueHandler } from "./handlers"

export function createDummyValueHandler(): ValueHandler {
    return {
        array: () => createDummyArrayHandler(),
        object: () => createDummyObjectHandler(),
        unquotedToken: () => {
            //do nothing
        },
        quotedString: () => {
            //do nothing
        },
        taggedUnion: () => createDummyValueHandler(),
    }
}

export function createDummyArrayHandler(): ArrayHandler {
    return {
        element: () => createDummyValueHandler(),
        end: () => {
            //do nothing
        },
    }
}

export function createDummyObjectHandler(): ObjectHandler {
    return {
        property: () => createDummyValueHandler(),
        end: () => {
            //do nothing
        },
    }
}
