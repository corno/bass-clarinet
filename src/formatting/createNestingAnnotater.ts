import { Annotater } from "../interfaces/IAnnotater";

export type NestingTokenAnnotation<InTokenAnnotation, OutTokenAnnotation> = {
    in: InTokenAnnotation
    out: OutTokenAnnotation
}

export type NestingNonTokenAnnotation<InNonTokenAnnotation, OutNonTokenAnnotation> = {
    in: InNonTokenAnnotation
    out: OutNonTokenAnnotation
}


export function createNestingAnnotater<
    InTokenAnnotation,
    InNonTokenAnnotation,
    OutTokenAnnotation,
    OutNonTokenAnnotation,
    >(
        nestedAnnotater: Annotater<
            InTokenAnnotation,
            InNonTokenAnnotation,
            OutTokenAnnotation,
            OutNonTokenAnnotation
            >
    ): Annotater<
        InTokenAnnotation,
        InNonTokenAnnotation,
        NestingTokenAnnotation<InTokenAnnotation, OutTokenAnnotation>,
        NestingNonTokenAnnotation<InNonTokenAnnotation, OutNonTokenAnnotation>
    > {
    return {
        objectBegin: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.objectBegin($),
            }
        },
        property: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.property($),
            }
        },
        objectEnd: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.objectEnd($),
            }
        },
        arrayBegin: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.arrayBegin($),
            }
        },
        element: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.element($),
            }
        },
        arrayEnd: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.arrayEnd($),
            }
        },
        stringValue: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.stringValue($),
            }
        },
        taggedUnionBegin: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.taggedUnionBegin($),
            }
        },
        option: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.option($),
            }
        },
        taggedUnionEnd: $ => {
            return {
                in: $.source,
                out: nestedAnnotater.taggedUnionEnd($),
            }
        },
    }
}