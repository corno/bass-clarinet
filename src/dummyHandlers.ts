import * as p from "pareto"
import { ArrayHandler, ObjectHandler, RequiredValueHandler, TaggedUnionHandler, ValueHandler } from "./interfaces/handlers"

export function createDummyRequiredValueHandler<TokenAnnotation, NonTokenAnnotation>(): RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> {
    return {
        exists: createDummyValueHandler(),
        missing: (): void => {
            //
        },
    }
}

export function createDummyValueHandler<TokenAnnotation, NonTokenAnnotation>(): ValueHandler<TokenAnnotation, NonTokenAnnotation> {
    return {
        array: (): ArrayHandler<TokenAnnotation, NonTokenAnnotation> => createDummyArrayHandler(),
        object: (): ObjectHandler<TokenAnnotation, NonTokenAnnotation> => createDummyObjectHandler(),
        string: (): p.IValue<boolean> => {
            //do nothing
            return p.value(false)
        },
        taggedUnion: (): TaggedUnionHandler<TokenAnnotation, NonTokenAnnotation> => {
            return {
                option: (): RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> => createDummyRequiredValueHandler(),
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

export function createDummyArrayHandler<TokenAnnotation, NonTokenAnnotation>(): ArrayHandler<TokenAnnotation, NonTokenAnnotation> {
    return {
        element: (): ValueHandler<TokenAnnotation, NonTokenAnnotation> => createDummyValueHandler(),
        arrayEnd: () => {
            //do nothing
            return p.value(null)
        },
    }
}

export function createDummyObjectHandler<TokenAnnotation, NonTokenAnnotation>(): ObjectHandler<TokenAnnotation, NonTokenAnnotation> {
    return {
        property: () => {
            return p.value(createDummyRequiredValueHandler())
        },
        objectEnd: () => {
            return p.value(null)
        },
    }
}
