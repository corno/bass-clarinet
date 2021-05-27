import * as p from "pareto"
import { ArrayHandler, ObjectHandler, RequiredValueHandler, TaggedUnionHandler, ValueHandler } from "../handlers"

export function createDummyRequiredValueHandler<Annotation>(): RequiredValueHandler<Annotation> {
    return {
        exists: createDummyValueHandler(),
        missing: (): void => {
            //
        },
    }
}

export function createDummyValueHandler<Annotation>(): ValueHandler<Annotation> {
    return {
        array: (): ArrayHandler<Annotation> => createDummyArrayHandler(),
        object: (): ObjectHandler<Annotation> => createDummyObjectHandler(),
        simpleValue: (): p.IValue<boolean> => {
            //do nothing
            return p.value(false)
        },
        taggedUnion: (): TaggedUnionHandler<Annotation> => {
            return {
                option: (): RequiredValueHandler<Annotation> => createDummyRequiredValueHandler(),
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

export function createDummyArrayHandler<Annotation>(): ArrayHandler<Annotation> {
    return {
        element: (): ValueHandler<Annotation> => createDummyValueHandler(),
        arrayEnd: () => {
            //do nothing
            return p.value(null)
        },
    }
}

export function createDummyObjectHandler<Annotation>(): ObjectHandler<Annotation> {
    return {
        property: () => {
            return p.value(createDummyRequiredValueHandler())
        },
        objectEnd: () => {
            return p.value(null)
        },
    }
}
