import * as p from "pareto"
import * as astn from ".."
import { ArrayBeginData, ArrayEndData, ObjectBeginData, ObjectEndData, OptionData, PropertyData, SimpleValueData2, TaggedUnionData } from "../handlers"
import { ExpectContext, ExpectedProperties } from "./ExpectContext"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type PropertyHandler<Annotation> = (data: astn.PropertyData<Annotation>) => ValueType<Annotation>

type OnInvalidType<Annotation> = (annotation: Annotation) => void

export type ValueType<Annotation> =
    // | [
    //     "shorthand type",
    //     {
    //         valueType: ValueType
    //         name: string
    //     }[],
    //     {
    //         onBegin?: (range: astn.Range, metaData: astn.ArrayOpenData) => void
    //         onEnd?: (range: astn.Range, metaData: astn.ArrayCloseData) => void
    //         onMissing?: () => void
    //         onInvalidType?: () => void
    //     }?
    // ]
    | [
        "boolean",
        (value: boolean, data: SimpleValueData2<Annotation>) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "dicionary",
        (propertyData: PropertyData<Annotation>) => ValueType<Annotation>,
        {
            onBegin: (data: ObjectBeginData<Annotation>) => void
            onEnd: (objectEndData: ObjectEndData<Annotation>) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }
    ]
    | ["list",
        ValueType<Annotation>,
        {
            onBegin: (data: ArrayBeginData<Annotation>) => void
            onEnd: (endData: ArrayEndData<Annotation>) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }
    ]
    | [
        "null",
        (data: SimpleValueData2<Annotation>) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "number",
        (number: number, data: SimpleValueData2<Annotation>) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "simple value",
        (data: SimpleValueData2<Annotation>) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "tagged union", {
            [key: string]: (
                taggedUnionData: TaggedUnionData<Annotation>,
                optionData: OptionData<Annotation>,
            ) => astn.RequiredValueHandler<Annotation>
        },
        {
            onUnexpectedOption?: (
                taggedUnionData: TaggedUnionData<Annotation>,
                optionData: OptionData<Annotation>,
            ) => void
            onMissingOption?: () => void
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "type",
        {
            [key: string]:
            | PropertyHandler<Annotation>
            | [PropertyHandler<Annotation>, {
                onNotExists?: (
                    beginData: ObjectBeginData<Annotation>,
                    endData: ObjectEndData<Annotation>,
                ) => void
            }?
            ]
        },
        {
            onBegin?: (data: ObjectBeginData<Annotation>) => void
            onEnd?: (hasErrors: boolean, data: ObjectEndData<Annotation>) => void
            onUnexpectedProperty?: (data: astn.PropertyData<Annotation>) => astn.RequiredValueHandler<Annotation>
            onMissing?: () => void
            onInvalidType?: OnInvalidType<Annotation>
        }?
    ]

export function createRequiredValueHandler<Annotation>(
    context: ExpectContext<Annotation>,
    valueType: ValueType<Annotation>,
): astn.RequiredValueHandler<Annotation> {
    return context.expectValue(
        createValueHandler(
            context,
            valueType,
        ),
        valueType[2]?.onMissing
    )
}

export function createValueHandler<Annotation>(
    context: ExpectContext<Annotation>,
    valueType: ValueType<Annotation>,
): astn.ValueHandler<Annotation> {
    switch (valueType[0]) {
        // case "shorthand type": {
        //     const $1 = valueType[1]
        //     const $2 = valueType[2]
        //     return context.expectShorthandType(
        //         $1.map(e => {
        //             return {
        //                 getHandler: (): astn.RequiredValueHandler => createRequiredValueHandler(
        //                     context,
        //                     e.valueType,
        //                 ),
        //                 name: e.name,
        //             }
        //         }),
        //         $2?.onBegin,
        //         $2?.onEnd,
        //         $2?.onInvalidType
        //     )
        // }
        case "boolean": {
            const $1 = valueType[1]
            const $2 = valueType[2]
            return context.expectBoolean(
                $1,
                $2?.onInvalidType,
            )
        }
        case "dicionary": {
            const $1 = valueType[1]
            const $2 = valueType[2]
            return context.expectDictionary(
                $2.onBegin,
                propertyData => {
                    return createRequiredValueHandler(
                        context,
                        $1(propertyData),
                    )
                },
                $2.onEnd,
                $2.onInvalidType,
            )
        }
        case "list": {
            const $1 = valueType[1]
            const $2 = valueType[2]
            return context.expectList(
                $2.onBegin,
                () => {
                    return createValueHandler(context, $1)
                },
                $2.onEnd,
                $2.onInvalidType,
            )
        }
        case "null": {
            const $1 = valueType[1]
            const $2 = valueType[2]

            return context.expectNull(
                $1,
                $2?.onInvalidType,
            )
        }
        case "number": {
            const $1 = valueType[1]
            const $2 = valueType[2]

            return context.expectNumber(
                $1,
                $2?.onInvalidType,
            )
        }
        case "simple value": {
            const $1 = valueType[1]
            const $2 = valueType[2]

            return context.expectSimpleValue(
                $1,
                $2?.onInvalidType,
            )
        }
        case "tagged union": {
            const $1 = valueType[1]
            const $2 = valueType[2]
            return context.expectTaggedUnion(
                $1,
                $2?.onUnexpectedOption,
                $2?.onMissingOption,
                $2?.onInvalidType,
            )
        }
        case "type": {
            const $1 = valueType[1]
            const $2 = valueType[2]
            const props: ExpectedProperties<Annotation> = {}
            Object.keys($1).forEach(key => {
                const rawProp = $1[key]
                if (rawProp instanceof Array) {
                    props[key] = {
                        onExists: data => {
                            return createRequiredValueHandler(context, rawProp[0](data))
                        },
                        onNotExists: rawProp[1] !== undefined && rawProp[1].onNotExists !== undefined
                            ? rawProp[1].onNotExists
                            : null,
                    }
                } else {
                    props[key] = {
                        onExists: data => {
                            return createRequiredValueHandler(context, rawProp(data))
                        },
                        onNotExists: null,
                    }
                }
            })
            return context.expectType(
                props,
                $2?.onBegin,
                $2?.onEnd,
                $2?.onUnexpectedProperty,
                $2?.onInvalidType,
            )
        }
        default:
            return assertUnreachable(valueType[0])
    }
}