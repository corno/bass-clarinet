import * as h from "./handlers"

export interface Annotater<InTokenAnnotation, InNonTokenAnnotation, OutTokenAnnotation, OutNonTokenAnnotation> {
    objectBegin: ($: {
        source: InTokenAnnotation
        data: h.ObjectData
        stackContext: h.StackContext
    }) => OutTokenAnnotation
    property: ($: {
        source: InTokenAnnotation
        propertyData: h.PropertyData
        objectData: h.ObjectData
        stackContext: h.StackContext
        isFirst: boolean
    }) => OutTokenAnnotation
    objectEnd: ($: {
        source: InTokenAnnotation
        data: h.ObjectData
        stackContext: h.StackContext
        isEmpty: boolean
    }) => OutTokenAnnotation

    arrayBegin: ($: {
        source: InTokenAnnotation
        data: h.ArrayData
        stackContext: h.StackContext
    }) => OutTokenAnnotation
    element: ($: {
        source: InNonTokenAnnotation
        elementData: h.ElementData
        arrayData: h.ArrayData
        stackContext: h.StackContext
        isFirst: boolean
    }) => OutNonTokenAnnotation
    arrayEnd: ($: {
        source: InTokenAnnotation
        data: h.ArrayData
        stackContext: h.StackContext
        isEmpty: boolean
    }) => OutTokenAnnotation

    stringValue: ($: {
        source: InTokenAnnotation
        data: h.StringValueData
        stackContext: h.StackContext
    }) => OutTokenAnnotation

    taggedUnionBegin: ($: {
        source: InTokenAnnotation
        stackContext: h.StackContext
    }) => OutTokenAnnotation
    option: ($: {
        source: InTokenAnnotation
        stackContext: h.StackContext
        data: h.OptionData
    }) => OutTokenAnnotation
    taggedUnionEnd: ($: {
        source: InNonTokenAnnotation
        stackContext: h.StackContext
    }) => OutNonTokenAnnotation

}