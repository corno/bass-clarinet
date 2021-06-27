/* eslint
    "max-classes-per-file": off,
*/

import * as astncore from "astn-core"
/* eslint
    "max-classes-per-file": off,
*/

export function createNOPSideEffects<Annotation>(): astncore.RootHandler<Annotation> {
    return {
        root: createValueNOPSideEffects(),
        onEnd: () => {
            //
        },
    }
}

function createVerboseTypeNOPSideEffects<Annotation>(): astncore.VerboseTypeHandler<Annotation> {
    return {
        onUnexpectedProperty: () => {
            //
        },
        onProperty: () => {
            return createValueNOPSideEffects()
        },
        // onUnexpectedProperty: () => {
        //     //
        // }
        onVerboseTypeClose: () => {
            //
        },
    }
}

function createShorthandTypeNOPSideEffects<Annotation>(): astncore.ShorthandTypeHandler<Annotation> {
    return {
        onShorthandTypeClose: () => {
            //
        },
        onProperty: () => {
            return createValueNOPSideEffects()
        },
    }
}

function createStateGroupNOPSideEffects<Annotation>(): astncore.TypedTaggedUnionHandler<Annotation> {
    return {
        onUnexpectedOption: () => {
            //
        },
        onOption: () => {
            return createValueNOPSideEffects()
        },
    }
}

function createValueNOPSideEffects<Annotation>(): astncore.TypedValueHandler<Annotation> {

    return {
        onDictionary: () => {
            return createDictionaryNOPSideEffects()
        },
        onList: () => {
            return createListNOPSideEffects()
        },
        onTaggedUnion: () => {
            return createStateGroupNOPSideEffects()
        },
        onSimpleString: () => {
            //
        },
        onMultilineString: () => {
            //
        },
        onNull: () => {
            //
        },
        onComponent: () => {
            return createValueNOPSideEffects()
        },
        onShorthandTypeOpen: () => {
            return createShorthandTypeNOPSideEffects()
        },
        onVerboseTypeOpen: () => {
            return createVerboseTypeNOPSideEffects()
        },
    }
}


function createDictionaryNOPSideEffects<Annotation>(): astncore.DictionaryHandler<Annotation> {
    return {
        onClose: () => {
            //
        },
        onEntry: () => {
            return createValueNOPSideEffects()
        },
    }
}

function createListNOPSideEffects<Annotation>(): astncore.ListHandler<Annotation> {
    return {
        onClose: () => {
            //
        },
        onEntry: () => {
            return createValueNOPSideEffects()
        },
    }
}