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

function createTypeNOPSideEffects<Annotation>(): astncore.TypeHandler<Annotation> {
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
        onClose: () => {
            //
        },
    }
}

function createStateGroupNOPSideEffects<Annotation>(): astncore.TypedTaggedUnionHandler<Annotation> {
    return {
        onUnexpectedOption: () => {
            return createValueNOPSideEffects()
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
        onComponent: () => {
            return createValueNOPSideEffects()
        },
        onShorthandTypeOpen: () => {
            return createTypeNOPSideEffects()
        },
        onVerboseTypeOpen: () => {
            return createTypeNOPSideEffects()
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
        onElement: () => {
            return createValueNOPSideEffects()
        },
    }
}