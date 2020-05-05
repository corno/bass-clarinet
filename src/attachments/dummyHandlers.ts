import { ArrayHandler, ObjectHandler, ValueHandler, RequiredValueHandler } from "./handlers"

export function createDummyRequiredValueHandler(): RequiredValueHandler {
    return {
        valueHandler: createDummyValueHandler(),
        onMissing: () => {
            //
        },
    }
}

    export function createDummyValueHandler(): ValueHandler {
    return {
        array: () => createDummyArrayHandler(),
        object: () => createDummyObjectHandler(),
        simpleValue: () => {
            //do nothing
        },
        taggedUnion: () => {
            return {
                option: () => createDummyRequiredValueHandler(),
                missingOption: () => {
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
            return createDummyRequiredValueHandler()
        },
        end: () => {
            //do nothing
        },
    }
}
