import * as p from "pareto"
import { ArrayHandler, ObjectHandler, OnValue, RequiredValueHandler, TaggedUnionHandler } from "./handlers"

export function createDummyRequiredValueHandler(): RequiredValueHandler {
    return {
        onValue: createDummyValueHandler(),
        onMissing: (): void => {
            //
        },
    }
}

export function createDummyValueHandler(): OnValue {
    return () => {
        return {
            array: (): ArrayHandler => createDummyArrayHandler(),
            object: (): ObjectHandler => createDummyObjectHandler(),
            simpleValue: (): p.IValue<boolean> => {
                //do nothing
                return p.result(false)
            },
            taggedUnion: (): TaggedUnionHandler => {
                return {
                    option: (): RequiredValueHandler => createDummyRequiredValueHandler(),
                    missingOption: (): void => {
                        //
                    },
                }
            },
        }
    }
}

export function createDummyArrayHandler(): ArrayHandler {
    return {
        element: (): OnValue => createDummyValueHandler(),
        end: (): void => {
            //do nothing
        },
    }
}

export function createDummyObjectHandler(): ObjectHandler {
    return {
        property: (): RequiredValueHandler => {
            return createDummyRequiredValueHandler()
        },
        end: (): void => {
            //do nothing
        },
    }
}
