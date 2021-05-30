import * as p from "pareto"
import * as astn from ".."
import { ArrayData, ObjectData, OptionData, StringValueData, PropertyData } from "../handlers"
import { ExpectedProperties, IExpectContext } from "../expect"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type PropertyHandler<TokenAnnotation, NonTokenAnnotation> = (data: {
    data: PropertyData
    annotation: TokenAnnotation
}) => ValueType<TokenAnnotation, NonTokenAnnotation>

type OnInvalidType<TokenAnnotation> = ($: {
    annotation: TokenAnnotation
}) => void

export type ValueType<TokenAnnotation, NonTokenAnnotation> =
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
        ($: {
            value: boolean
            data: StringValueData
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "dicionary",
        ($: {
            data: PropertyData
            annotation: TokenAnnotation
        }) => ValueType<TokenAnnotation, NonTokenAnnotation>,
        {
            onBegin: ($: {
                data: ObjectData
                annotation: TokenAnnotation
            }) => void
            onEnd: ($: {
                annotation: TokenAnnotation
            }) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }
    ]
    | ["list",
        ValueType<TokenAnnotation, NonTokenAnnotation>,
        {
            onBegin: ($: {
                data: ArrayData
                annotation: TokenAnnotation
            }) => void
            onEnd: ($: {
                annotation: TokenAnnotation
            }) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }
    ]
    | [
        "null",
        ($: {
            data: StringValueData
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "number",
        ($: {
            value: number
            data: StringValueData
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "string",
        ($: {
            data: StringValueData
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "tagged union", {
            [key: string]: (
                taggedUnionData: {
                    annotation: TokenAnnotation
                },
                optionData: {
                    data: OptionData
                    annotation: TokenAnnotation
                },
            ) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
        },
        {
            onUnexpectedOption?: ($: {
                tuAnnotation: TokenAnnotation
                data: OptionData
                optionAnnotation: TokenAnnotation
            }) => void
            onMissingOption?: () => void
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "type",
        {
            [key: string]:
            | PropertyHandler<TokenAnnotation, NonTokenAnnotation>
            | [PropertyHandler<TokenAnnotation, NonTokenAnnotation>, {
                onNotExists?: ($: {
                    data: ObjectData
                    beginAnnotation: TokenAnnotation
                    endAnnotation: TokenAnnotation
                }) => void
            }?
            ]
        },
        {
            onBegin?: ($: {
                data: ObjectData
                annotation: TokenAnnotation
            }) => void
            onEnd?: ($: {
                hasErrors: boolean
                annotation: TokenAnnotation
            }) => void
            onUnexpectedProperty?: ($: {
                data: PropertyData
                annotation: TokenAnnotation
            }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
            onMissing?: () => void
            onInvalidType?: OnInvalidType<TokenAnnotation>
        }?
    ]

export function createRequiredValueHandler<TokenAnnotation, NonTokenAnnotation>(
    context: IExpectContext<TokenAnnotation, NonTokenAnnotation>,
    valueType: ValueType<TokenAnnotation, NonTokenAnnotation>,
): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> {
    return context.expectValue(
        createValueHandler(
            context,
            valueType,
        ),
        valueType[2]?.onMissing
    )
}

export function createValueHandler<TokenAnnotation, NonTokenAnnotation>(
    context: IExpectContext<TokenAnnotation, NonTokenAnnotation>,
    valueType: ValueType<TokenAnnotation, NonTokenAnnotation>,
): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {
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
        case "string": {
            const $1 = valueType[1]
            const $2 = valueType[2]

            return context.expectString(
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
            const props: ExpectedProperties<TokenAnnotation, NonTokenAnnotation> = {}
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