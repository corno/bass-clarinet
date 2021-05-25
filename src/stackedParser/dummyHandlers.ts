import * as p from "pareto"
import { ArrayHandler, ObjectHandler, OnValue, RequiredValueHandler, TaggedUnionHandler } from "./handlers"

export function createDummyRequiredValueHandler(): RequiredValueHandler {
    return {
        onExists: createDummyValueHandler(),
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
                return p.value(false)
            },
            taggedUnion: (): TaggedUnionHandler => {
                return {
                    option: (): RequiredValueHandler => createDummyRequiredValueHandler(),
                    missingOption: (): void => {
                        //
                    },
                    end: () => {
                        //
                    },
                }
            },
        }
    }
}

export function createDummyArrayHandler(): ArrayHandler {
    return {
        onData: (): OnValue => createDummyValueHandler(),
        onEnd: () => {
            //do nothing
            return p.value(null)
        },
    }
}

export function createDummyObjectHandler(): ObjectHandler {
    return {
        onData: () => {
            return p.value(createDummyRequiredValueHandler())
        },
        onEnd: () => {
            return p.value(null)
        },
    }
}
