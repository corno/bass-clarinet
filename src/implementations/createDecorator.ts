import * as p from "pareto"
import * as h from "../interfaces/handlers";
import { Annotater } from "../interfaces/IAnnotater";


export function createDecoratedValue<InTokenAnnotation, InNonTokenAnnotation, OutTokenAnnotation, OutNonTokenAnnotation>(
    downstream: h.ValueHandler<OutTokenAnnotation, OutNonTokenAnnotation>,
    annotater: Annotater<InTokenAnnotation, InNonTokenAnnotation, OutTokenAnnotation, OutNonTokenAnnotation>,
): h.ValueHandler<InTokenAnnotation, InNonTokenAnnotation> {
    return {
        object: $ => {
            const ds = downstream.object({
                data: $.data,
                annotation: annotater.objectBegin({
                    source: $.annotation,
                    stackContext: $.stackContext,
                    data: $.data,
                }),
                stackContext: $.stackContext,
            })
            let foundProperties = false
            return {
                property: $$ => {
                    const wasFirst = !foundProperties
                    foundProperties = true
                    return ds.property({
                        annotation: annotater.property({
                            source: $.annotation,
                            propertyData: $$.data,
                            objectData: $.data,
                            stackContext: $.stackContext,
                            isFirst: wasFirst,
                        }),
                        stackContext: $.stackContext,
                        data: $$.data,
                    }).mapResult(x => {
                        return p.value(createDecoratedRequiredValue(
                            annotater,
                            x,
                        ))
                    })
                },
                objectEnd: $$ => {
                    return ds.objectEnd({
                        annotation: annotater.objectEnd({
                            source: $$.annotation,
                            data: $.data,
                            isEmpty: !foundProperties,
                            stackContext: $.stackContext,
                        }),
                        stackContext: $$.stackContext,
                    })
                },
            }
        },
        array: $ => {
            const ds = downstream.array({
                data: $.data,
                annotation: annotater.arrayBegin({
                    source: $.annotation,
                    data: $.data,
                    stackContext: $.stackContext,
                }),
                stackContext: $.stackContext,
            })
            let foundElements = false
            return {
                element: $$ => {
                    const wasFirst = !foundElements
                    foundElements = true
                    return createDecoratedValue(
                        ds.element({
                            stackContext: $$.stackContext,
                            annotation: annotater.element({
                                source: $$.annotation,
                                arrayData: $.data,
                                elementData: $$.data,
                                stackContext: $.stackContext,
                                isFirst: wasFirst,
                            }),
                            data: $$.data,
                        }),
                        annotater
                    )
                },
                arrayEnd: $$ => {
                    return ds.arrayEnd({
                        annotation: annotater.arrayEnd({
                            source: $$.annotation,
                            data: $.data,
                            stackContext: $.stackContext,
                            isEmpty: !foundElements,
                        }),
                        stackContext: $$.stackContext,
                    })
                },
            }
        },
        string: $ => {
            return downstream.string({
                data: $.data,
                annotation: annotater.stringValue({
                    source: $.annotation,
                    data: $.data,
                    stackContext: $.stackContext,
                }),
                stackContext: $.stackContext,
            })
        },
        taggedUnion: $ => {
            const ds = downstream.taggedUnion({
                annotation: annotater.taggedUnionBegin({
                    source: $.annotation,
                    stackContext: $.stackContext,
                }),
                stackContext: $.stackContext,
            })
            return {
                option: $$ => {
                    return createDecoratedRequiredValue(
                        annotater,
                        ds.option({
                            data: $$.data,
                            stackContext: $$.stackContext,
                            annotation: annotater.option({
                                source: $$.annotation,
                                data: $$.data,
                                stackContext: $.stackContext,
                            }),
                        }),
                    )
                },
                missingOption: () => {
                    return ds.missingOption()
                },
                end: $$ => {
                    return ds.end({
                        annotation: annotater.taggedUnionEnd({
                            source: $$.annotation,
                            stackContext: $.stackContext,
                        }),
                    })
                },
            }
        },
    }
}

export function createDecoratedRequiredValue<InTokenAnnotation, InNonTokenAnnotation, OutTokenAnnotation, OutNonTokenAnnotation>(
    annotater: Annotater<InTokenAnnotation, InNonTokenAnnotation, OutTokenAnnotation, OutNonTokenAnnotation>,
    downstream: h.RequiredValueHandler<OutTokenAnnotation, OutNonTokenAnnotation>,
): h.RequiredValueHandler<InTokenAnnotation, InNonTokenAnnotation> {
    return {
        exists: createDecoratedValue(downstream.exists, annotater),
        missing: () => downstream.missing(),
    }
}

export function createDecoratedTree<InTokenAnnotation, InNonTokenAnnotation, OutTokenAnnotation, OutNonTokenAnnotation>(
    annotater: Annotater<InTokenAnnotation, InNonTokenAnnotation, OutTokenAnnotation, OutNonTokenAnnotation>,
    downstream: h.RequiredValueHandler<OutTokenAnnotation, OutNonTokenAnnotation>,
): h.TreeHandler<InTokenAnnotation, InNonTokenAnnotation> {
    return {
        root: createDecoratedRequiredValue(annotater, downstream),
    }
}