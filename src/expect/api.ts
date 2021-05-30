import * as h from "../handlers"
import * as p from "pareto"


export type ExpectErrorValueType =
    | "boolean"
    | "null"
    | "number"
    | "object"
    | "dictionary"
    | "array"
    | "nothing"
    | "list"
    | "shorthand type"
    | "tagged union"
    | "string"
    | "quoted string"
    | "type"
    | "type or shorthand type"

export type ExpectErrorValue = {
    type: ExpectErrorValueType
    "null allowed": boolean
}

export type ExpectedToken =
    | "open angle bracket"
    | "close angle bracket"
    | "open bracket"
    | "close bracket"
    | "open paren"
    | "close paren"
    | "open curly"
    | "close curly"


export type OnInvalidType<TokenAnnotation> = null | (($: {
    annotation: TokenAnnotation
}) => void)

export type ExpectedElement<TokenAnnotation, NonTokenAnnotation> = {
    name: string
    getHandler: () => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
}

export type ExpectedElements<TokenAnnotation, NonTokenAnnotation> = ExpectedElement<TokenAnnotation, NonTokenAnnotation>[]

export type ExpectedProperty<TokenAnnotation, NonTokenAnnotation> = {
    onExists: ($: {
        data: h.PropertyData
        annotation: TokenAnnotation
    }) => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
    onNotExists: null | (($: {
        data: h.ObjectData
        beginAnnotation: TokenAnnotation
        endAnnotation: TokenAnnotation
    }) => void
    ) //if onNotExists is null and the property does not exist, an error will be raised
}

export type ExpectedProperties<TokenAnnotation, NonTokenAnnotation> = {
    [key: string]: ExpectedProperty<TokenAnnotation, NonTokenAnnotation>
}

export type Options<TokenAnnotation, NonTokenAnnotation> = {
    [key: string]: (
        taggedUnionData: {
            annotation: TokenAnnotation
        },
        optionData: {
            data: h.OptionData
            annotation: TokenAnnotation
        },
    ) => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
}

export interface IExpectContext<TokenAnnotation, NonTokenAnnotation> {
    // createDictionaryHandler(
    //     onEntry: ($: {
    //         data: h.PropertyData
    //         annotation: TokenAnnotation
    //     }) => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
    //     onBegin?: ($: {
    //         data: h.ObjectData
    //         annotation: TokenAnnotation
    //     }) => void,
    //     onEnd?: ($: {
    //         annotation: TokenAnnotation
    //     }) => void,
    // ): h.OnObject<TokenAnnotation, NonTokenAnnotation>
    // createTypeHandler(
    //     expectedProperties: ExpectedProperties<TokenAnnotation, NonTokenAnnotation>,
    //     onBegin?: ($: {
    //         data: h.ObjectData
    //         annotation: TokenAnnotation
    //     }) => void,
    //     onEnd?: ($: {
    //         hasErrors: boolean
    //         annotation: TokenAnnotation
    //     }) => void,
    //     onUnexpectedProperty?: ($: {
    //         data: h.PropertyData
    //         annotation: TokenAnnotation
    //     }) => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
    // ): h.OnObject<TokenAnnotation, NonTokenAnnotation>
    // createShorthandTypeHandler(
    //     expectedElements: ExpectedElements<TokenAnnotation, NonTokenAnnotation>,
    //     onBegin?: ($: {
    //         data: h.ArrayData
    //         annotation: TokenAnnotation
    //     }) => void,
    //     onEnd?: ($: {
    //         annotation: TokenAnnotation
    //     }) => void
    // ): h.OnArray<TokenAnnotation, NonTokenAnnotation>
    // createListHandler(
    //     onElement: () => h.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
    //     onBegin?: ($: {
    //         data: h.ArrayData
    //         annotation: TokenAnnotation
    //     }) => void,
    //     onEnd?: ($: {
    //         annotation: TokenAnnotation
    //     }) => void,
    // ): h.OnArray<TokenAnnotation, NonTokenAnnotation>
    // createTaggedUnionHandler(
    //     options: Options<TokenAnnotation, NonTokenAnnotation>,
    //     onUnexpectedOption?: ($: {
    //         tuAnnotation: TokenAnnotation
    //         data: h.OptionData
    //         optionAnnotation: TokenAnnotation
    //     }) => void,
    //     onMissingOption?: () => void,
    // ): h.OnTaggedUnion<TokenAnnotation, NonTokenAnnotation>
    // createUnexpectedStringHandler(
    //     expected: ExpectErrorValue,
    //     onInvalidType?: OnInvalidType<TokenAnnotation>,
    //     onNull?: ($: {
    //         data: h.StringData2
    //         annotation: TokenAnnotation
    //     }) => p.IValue<boolean>,
    // ): h.OnString<TokenAnnotation>
    // createNullHandler(
    //     expected: ExpectErrorValue,
    //     onInvalidType?: OnInvalidType<TokenAnnotation>,
    // ): h.OnString<TokenAnnotation>
    // createUnexpectedTaggedUnionHandler(
    //     expected: ExpectErrorValue,
    //     onInvalidType?: OnInvalidType<TokenAnnotation>,
    // ): h.OnTaggedUnion<TokenAnnotation, NonTokenAnnotation>
    // createUnexpectedObjectHandler(
    //     expected: ExpectErrorValue,
    //     onInvalidType?: OnInvalidType<TokenAnnotation>,
    // ): h.OnObject<TokenAnnotation, NonTokenAnnotation>
    // createUnexpectedArrayHandler(
    //     expected: ExpectErrorValue,
    //     onInvalidType?: OnInvalidType<TokenAnnotation>,
    // ): h.OnArray<TokenAnnotation, NonTokenAnnotation>
    expectNothing(
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectString(
        callback: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectBoolean(
        callback: ($: {
            value: boolean
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectNull(
        callback: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectValue(
        onValue: h.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onMissing?: () => void,
    ): h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectNumber(
        callback: ($: {
            value: number
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectQuotedString(
        callback: ($: {
            value: string
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectDictionary(
        onBegin: ($: {
            data: h.ObjectData
            annotation: TokenAnnotation
        }) => void,
        onProperty: ($: {
            data: h.PropertyData
            annotation: TokenAnnotation
        }) => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onEnd: ($: {
            annotation: TokenAnnotation
        }) => void,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectType(
        expectedProperties: ExpectedProperties<TokenAnnotation, NonTokenAnnotation>,
        onBegin?: ($: {
            data: h.ObjectData
            annotation: TokenAnnotation
        }) => void,
        onEnd?: ($: {
            hasErrors: boolean
            annotation: TokenAnnotation
        }) => void,
        onUnexpectedProperty?: ($: {
            data: h.PropertyData
            annotation: TokenAnnotation
        }) => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectList(
        onBegin: ($: {
            data: h.ArrayData
            annotation: TokenAnnotation
        }) => void,
        onElement: () => h.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onEnd: ($: {
            annotation: TokenAnnotation
        }) => void,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectShorthandType(
        expectedElements: ExpectedElements<TokenAnnotation, NonTokenAnnotation>,
        onBegin?: ($: {
            data: h.ArrayData
            annotation: TokenAnnotation
        }) => void,
        onEnd?: ($: {
            annotation: TokenAnnotation
        }) => void,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectTypeOrShorthandType(
        expectedProperties: ExpectedProperties<TokenAnnotation, NonTokenAnnotation>,
        expectedElements: ExpectedElements<TokenAnnotation, NonTokenAnnotation>,
        onTypeBegin?: ($: {
            data: h.ObjectData
            annotation: TokenAnnotation
        }) => void,
        onTypeEnd?: ($: {
            hasErrors: boolean
            annotation: TokenAnnotation
        }) => void,
        onUnexpectedProperty?: ($: {
            data: h.PropertyData
            annotation: TokenAnnotation
        }) => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onShorthandTypeBegin?: ($: {
            data: h.ArrayData
            annotation: TokenAnnotation
        }) => void,
        onShorthandTypeEnd?: ($: {
            annotation: TokenAnnotation
        }) => void,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    expectTaggedUnion(
        options: Options<TokenAnnotation, NonTokenAnnotation>,
        onUnexpectedOption?: ($: {
            tuAnnotation: TokenAnnotation
            data: h.OptionData
            optionAnnotation: TokenAnnotation
        }) => void,
        onMissingOption?: () => void,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: ($: {
            data: h.StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): h.ValueHandler<TokenAnnotation, NonTokenAnnotation>
}
