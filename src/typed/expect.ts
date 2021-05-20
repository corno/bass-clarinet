import * as p from "pareto"
import * as astn from ".."
import { ExpectContext, ExpectedProperties } from "./ExpectContext"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type PropertyHandler = (range: astn.Range, contextData: astn.ContextData) => ValueType

type OnInvalidType = (range: astn.Range) => void

export type ValueType =
    | [
        "array type",
        ValueType[],
        {
            onBegin?: (range: astn.Range, metaData: astn.ArrayOpenData) => void
            onEnd?: (range: astn.Range, metaData: astn.ArrayCloseData) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "boolean",
        (value: boolean, range: astn.Range, metaData: astn.SimpleValueData) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "dicionary",
        (key: string, range: astn.Range, contextData: astn.ContextData) => ValueType,
        {
            onBegin: (range: astn.Range, metaData: astn.ObjectOpenData) => void
            onEnd: (range: astn.Range, metaData: astn.ObjectCloseData) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }
    ]
    | ["list",
        ValueType,
        {
            onBegin: (range: astn.Range, metaData: astn.ArrayOpenData) => void
            onEnd: (range: astn.Range, metaData: astn.ArrayCloseData) => void
            onMissing?: () => void
            onInvalidType?: () => void
        }
    ]
    | [
        "null",
        (range: astn.Range, metaData: astn.SimpleValueData) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "number",
        (number: number, range: astn.Range, data: astn.SimpleValueData) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "simple value",
        (range: astn.Range, metaData: astn.SimpleValueData) => p.IValue<boolean>,
        {
            onMissing?: () => void
            onInvalidType?: () => void
        }?
    ]
    | [
        "tagged union", {
            [key: string]: (
                taggedUnionRange: astn.Range,
                optionRange: astn.Range,
                optionContextData: astn.ContextData,
            ) => astn.RequiredValueHandler
        },
        {
            onUnexpectedOption?: (
                option: string,
                taggedUnionRange: astn.Range,
                optionRange: astn.Range,
                optionContextData: astn.ContextData
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
            onBegin?: (range: astn.Range, openData: astn.ObjectOpenData) => void
            onEnd?: (hasErrors: boolean, endRange: astn.Range, endData: astn.ObjectCloseData, contextData: astn.ContextData) => void
            onUnexpectedProperty?: (key: string, range: astn.Range, contextData: astn.ContextData) => astn.RequiredValueHandler
            onMissing?: () => void
            onInvalidType?: OnInvalidType
        }?
    ]

export function createRequiredValueHandler(
    context: ExpectContext,
    valueType: ValueType,
): astn.RequiredValueHandler {
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
): astn.ValueHandler {
    switch (valueType[0]) {
        case "array type": {
            const $1 = valueType[1]
            const $2 = valueType[2]
            return context.expectShorthandType(
                $1.map(e => {
                    return (): astn.RequiredValueHandler => createRequiredValueHandler(
                        context,
                        e,
                    )
                }),
                $2?.onBegin,
                $2?.onEnd,
                $2?.onInvalidType
            )
        }
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
                (key, metaData, contextData) => {
                    return createRequiredValueHandler(
                        context,
                        $1(key, metaData, contextData),
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
                        onExists: (range: astn.Range, contextData: astn.ContextData) => {
                            return createRequiredValueHandler(context, rawProp[0](range, contextData))
                        },
                        onNotExists: rawProp[1] !== undefined && rawProp[1].onNotExists !== undefined
                            ? rawProp[1].onNotExists
                            : null,
                    }
                } else {
                    props[key] = {
                        onExists: (range: astn.Range, contextData: astn.ContextData) => {
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