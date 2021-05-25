import * as p from "pareto"
import * as astn from ".."
import { ParserAnnotationData } from "../stackedParser/createStackedParser"
import { ArrayBeginData, ArrayEndData, ObjectBeginData, ObjectEndData, OptionData, PropertyData, SimpleValueData2, TaggedUnionData } from "../stackedParser/handlers"
import { ExpectContext, ExpectedProperties } from "./ExpectContext"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type PropertyHandler = (range: astn.Range, contextData: astn.ParserAnnotationData) => ValueType

type OnInvalidType = (range: astn.Range) => void

export type ValueType =
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
        (value: boolean, data: SimpleValueData2<ParserAnnotationData>) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "dicionary",
        (propertyData: PropertyData<ParserAnnotationData>) => ValueType,
        {
            onBegin: (range: astn.Range, metaData: astn.ObjectOpenData) => void
            onEnd: (objectEndData: ObjectEndData<ParserAnnotationData>) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }
    ]
    | ["list",
        ValueType,
        {
            onBegin: (data: ArrayBeginData<ParserAnnotationData>) => void
            onEnd: (endData: ArrayEndData<ParserAnnotationData>) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }
    ]
    | [
        "null",
        (data: SimpleValueData2<ParserAnnotationData>) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "number",
        (number: number, data: SimpleValueData2<ParserAnnotationData>) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "simple value",
        (data: SimpleValueData2<ParserAnnotationData>) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "tagged union", {
            [key: string]: (
                taggedUnionData: TaggedUnionData<ParserAnnotationData>,
                optionData: OptionData<ParserAnnotationData>,
            ) => astn.RequiredValueHandler<ParserAnnotationData>
        },
        {
            onUnexpectedOption?: (
                taggedUnionData: TaggedUnionData<ParserAnnotationData>,
                optionData: OptionData<ParserAnnotationData>,
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
            | PropertyHandler
            | [PropertyHandler, {
                onNotExists?: (
                    openRangeOfContainingType: astn.Range,
                    openDataOfContainingType: astn.ObjectOpenData,
                    closeRangeOfContainingType: astn.Range,
                    closeDataOfContainingType: astn.ObjectCloseData
                ) => void
            }?
            ]
        },
        {
            onBegin?: (data: ObjectBeginData<ParserAnnotationData>) => void
            onEnd?: (hasErrors: boolean, endRange: astn.Range, endData: astn.ObjectCloseData, contextData: astn.ParserAnnotationData) => void
            onUnexpectedProperty?: (key: string, range: astn.Range, contextData: astn.ParserAnnotationData) => astn.RequiredValueHandler<ParserAnnotationData>
            onMissing?: () => void
            onInvalidType?: OnInvalidType
        }?
    ]

export function createRequiredValueHandler(
    context: ExpectContext,
    valueType: ValueType,
): astn.RequiredValueHandler<ParserAnnotationData> {
    return context.expectValue(
        () => createValueHandler(
            context,
            valueType,
        ),
        valueType[2]?.onMissing
    )
}

export function createValueHandler(
    context: ExpectContext,
    valueType: ValueType,
): astn.ValueHandler<ParserAnnotationData> {
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
                    return () => createValueHandler(context, $1)
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
            const props: ExpectedProperties = {}
            Object.keys($1).forEach(key => {
                const rawProp = $1[key]
                if (rawProp instanceof Array) {
                    props[key] = {
                        onExists: (range: astn.Range, contextData: astn.ParserAnnotationData) => {
                            return createRequiredValueHandler(context, rawProp[0](range, contextData))
                        },
                        onNotExists: rawProp[1] !== undefined && rawProp[1].onNotExists !== undefined
                            ? rawProp[1].onNotExists
                            : null,
                    }
                } else {
                    props[key] = {
                        onExists: (range: astn.Range, contextData: astn.ParserAnnotationData) => {
                            return createRequiredValueHandler(context, rawProp(range, contextData))
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