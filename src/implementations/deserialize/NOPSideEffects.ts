/* eslint
    "max-classes-per-file": off,
*/

import * as astncore from "astn-core"

export function createNOPSideEffects<Annotation, ReturnType>(
    createReturnValue: () => ReturnType
): astncore.RootHandler<Annotation, ReturnType> {
    return {
        root: createValueNOPSideEffects(),
        onEnd: () => {
            return createReturnValue()
        },
    }
}

function createGroupNOPSideEffects<Annotation>(): astncore.GroupHandler<Annotation> {
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

function createTaggedUnionNOPSideEffects<Annotation>(): astncore.TypedTaggedUnionHandler<Annotation> {
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
            return createTaggedUnionNOPSideEffects()
        },
        onSimpleString: () => {
            //
        },
        onMultilineString: () => {
            //
        },
        onTypeReference: () => {
            return createValueNOPSideEffects()
        },
        onGroup: () => {
            return createGroupNOPSideEffects()
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