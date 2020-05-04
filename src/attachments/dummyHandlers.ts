import { ArrayHandler, ObjectHandler, ValueHandler, ExpectedValueHandler } from "./handlers"

export function createDummyValueHandler(): ValueHandler {
    return {
        array: () => createDummyArrayHandler(),
        object: () => createDummyObjectHandler(),
        simpleValue: () => {
            //do nothing
        },
        taggedUnion: () => {
            return {
                onOption: () => createDummyExpectedValueHandler(),
                onMissingOption: () => {
                    //
                },
            }
        },
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
        property: () => {
            return {
                onValue: createDummyValueHandler(),
                onMissing: () => {
                    //
                },
            }
        },
        end: () => {
            //do nothing
        },
    }
}

export function createDummyExpectedValueHandler(): ExpectedValueHandler {
    return {
        onValue: createDummyValueHandler(),
        onMissing: () => {
            //do nothing
        },
    }
}
