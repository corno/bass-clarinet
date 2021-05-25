import * as p from "pareto"
import { ArrayHandler, ObjectHandler, RequiredValueHandler, TaggedUnionHandler, ValueHandler } from "../handlers"

export function createDummyRequiredValueHandler<Annotation>(): RequiredValueHandler<Annotation> {
    return {
        onExists: createDummyValueHandler(),
        onMissing: (): void => {
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
        onData: (): ValueHandler<Annotation> => createDummyValueHandler(),
        onEnd: () => {
            //do nothing
            return p.value(null)
        },
    }
}

export function createDummyObjectHandler<Annotation>(): ObjectHandler<Annotation> {
    return {
        onData: () => {
            return p.value(createDummyRequiredValueHandler())
        },
        onEnd: () => {
            return p.value(null)
        },
    }
}
