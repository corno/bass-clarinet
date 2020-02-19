import { ArrayHandler, ObjectHandler, ValueHandler } from "./createStackedDataSubscriber"

export function createDummyValueHandler(): ValueHandler {
    return {
        array: () => createDummyArrayHandler(),
        object: () => createDummyObjectHandler(),
        boolean: () => {
            //do nothing
        },
        number: () => {
            //do nothing
        },
        string: () => {
            //do nothing
        },
        null: () => {
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
