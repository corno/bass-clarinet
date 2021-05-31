/* eslint
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as astn from "../.."
import * as h from "../../interfaces/handlers"
import {
    ExpectedElements,
    ExpectedProperties,
    ExpectErrorValue,
    IExpectContext,
    OnInvalidType,
    Options,
} from "../../interfaces/IExpectContext"
import {
    ExpectError, ExpectErrorHandler, OnDuplicateEntry, Severity,
} from "./functionTypes"
import { createSerializedString } from "../../formatting"
import { ArrayData, OptionData, ObjectData, PropertyData, StringValueData } from "../../interfaces/handlers"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type CreateDummyOnProperty<TokenAnnotation, NonTokenAnnotation> = ($: {
    key: string
    annotation: TokenAnnotation
}) => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>

interface ICreateContext<TokenAnnotation, NonTokenAnnotation> {
    createDictionaryHandler(
        onEntry: ($: {
            data: h.PropertyData
            annotation: TokenAnnotation
        }) => h.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onBegin?: ($: {
            data: h.ObjectData
            annotation: TokenAnnotation
        }) => void,
        onEnd?: ($: {
            annotation: TokenAnnotation
        }) => void,
    ): h.OnObject<TokenAnnotation, NonTokenAnnotation>
    createTypeHandler(
        expectedProperties?: ExpectedProperties<TokenAnnotation, NonTokenAnnotation>,
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
    ): h.OnObject<TokenAnnotation, NonTokenAnnotation>
    createShorthandTypeHandler(
        expectedElements: ExpectedElements<TokenAnnotation, NonTokenAnnotation>,
        onBegin?: ($: {
            data: h.ArrayData
            annotation: TokenAnnotation
        }) => void,
        onEnd?: ($: {
            annotation: TokenAnnotation
        }) => void
    ): h.OnArray<TokenAnnotation, NonTokenAnnotation>
    createListHandler(
        onElement: () => h.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onBegin?: ($: {
            data: h.ArrayData
            annotation: TokenAnnotation
        }) => void,
        onEnd?: ($: {
            annotation: TokenAnnotation
        }) => void,
    ): h.OnArray<TokenAnnotation, NonTokenAnnotation>
    createTaggedUnionHandler(
        options: Options<TokenAnnotation, NonTokenAnnotation>,
        onUnexpectedOption?: ($: {
            tuAnnotation: TokenAnnotation
            data: h.OptionData
            optionAnnotation: TokenAnnotation
        }) => void,
        onMissingOption?: () => void,
    ): h.OnTaggedUnion<TokenAnnotation, NonTokenAnnotation>
    createUnexpectedStringHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: ($: {
            data: h.StringValueData
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): h.OnString<TokenAnnotation>
    createNullHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.OnString<TokenAnnotation>
    createUnexpectedTaggedUnionHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.OnTaggedUnion<TokenAnnotation, NonTokenAnnotation>
    createUnexpectedObjectHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.OnObject<TokenAnnotation, NonTokenAnnotation>
    createUnexpectedArrayHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): h.OnArray<TokenAnnotation, NonTokenAnnotation>
}

function createCreateContext<TokenAnnotation, NonTokenAnnotation>(
    errorHandler: ExpectErrorHandler<TokenAnnotation>,
    warningHandler: ExpectErrorHandler<TokenAnnotation>,
    //createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler,
    //createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler,
    createDummyPropertyHandler: CreateDummyOnProperty<TokenAnnotation, NonTokenAnnotation>,
    createDummyValueHandler: () => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
    duplicateEntrySeverity: Severity,
    onDuplicateEntry: OnDuplicateEntry,
): ICreateContext<TokenAnnotation, NonTokenAnnotation> {

    function raiseWarning(issue: ExpectError, annotation: TokenAnnotation): void {
        warningHandler({
            issue: issue,
            annotation: annotation,
        })
    }
    function raiseError(issue: ExpectError, annotation: TokenAnnotation): void {
        errorHandler({
            issue: issue,
            annotation: annotation,
        })
    }

    function createDummyRequiredValueHandler(): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> {
        return {
            exists: createDummyValueHandler(),
            missing: () => {
                //
            },
        }
    }

    return {
        createDictionaryHandler: (onEntry, onBegin, onEnd) => {
            return data => {

                if (data.data.type[0] !== "dictionary") {
                    raiseWarning(["object is not a dictionary", {}], data.annotation)
                }
                if (onBegin) {
                    onBegin(data)
                }
                const foundEntries: string[] = []
                return {
                    property: propertyData => {
                        const process = (): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> => {
                            if (foundEntries.includes(propertyData.data.key)) {
                                switch (duplicateEntrySeverity) {
                                    case Severity.error:
                                        raiseError(["duplicate entry", { key: propertyData.data.key }], propertyData.annotation)
                                        break
                                    case Severity.nothing:
                                        break
                                    case Severity.warning:
                                        raiseWarning(["duplicate entry", { key: propertyData.data.key }], propertyData.annotation)
                                        break
                                    default:
                                        assertUnreachable(duplicateEntrySeverity)
                                }
                                switch (onDuplicateEntry) {
                                    case OnDuplicateEntry.ignore:
                                        return createDummyRequiredValueHandler()
                                    case OnDuplicateEntry.overwrite:
                                        return onEntry(propertyData)
                                    default:
                                        return assertUnreachable(onDuplicateEntry)
                                }
                            } else {
                                return onEntry(propertyData)
                            }

                        }
                        const vh = process()
                        foundEntries.push(propertyData.data.key)
                        return p.value(vh)
                    },
                    objectEnd: endData => {
                        if (onEnd) {
                            onEnd(endData)
                        }
                        return p.value(null)
                    },
                }
            }
        },
        createTypeHandler: (expectedProperties, onBegin, onEnd, onUnexpectedProperty) => {
            const properties = expectedProperties ? expectedProperties : {}
            return data => {

                if (data.data.type[0] !== "verbose type") {
                    raiseWarning(["object is not a verbose type", {}], data.annotation)
                }
                if (onBegin) {
                    onBegin(data)
                }
                const foundProperies: string[] = []
                let hasErrors = false
                return {
                    property: propertyData => {
                        const onProperty = (): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> => {
                            const expected = properties[propertyData.data.key]
                            if (expected === undefined) {
                                hasErrors = true
                                raiseWarning(["unexpected property", {
                                    "found key": propertyData.data.key,
                                    "valid keys": Object.keys(properties).sort(),
                                }], propertyData.annotation)
                                if (onUnexpectedProperty !== undefined) {
                                    return onUnexpectedProperty(propertyData)
                                } else {
                                    return {
                                        exists: createDummyPropertyHandler({
                                            key: propertyData.data.key,
                                            annotation: propertyData.annotation,
                                        }),
                                        missing: () => {
                                            //
                                        },
                                    }
                                }
                            }
                            return expected.onExists(propertyData)
                        }
                        const process = (): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> => {
                            if (foundProperies.includes(propertyData.data.key)) {
                                switch (duplicateEntrySeverity) {
                                    case Severity.error:
                                        raiseError(["duplicate property", { name: propertyData.data.key }], propertyData.annotation)
                                        break
                                    case Severity.nothing:
                                        break
                                    case Severity.warning:
                                        raiseWarning(["duplicate property", { name: propertyData.data.key }], propertyData.annotation)
                                        break
                                    default:
                                        return assertUnreachable(duplicateEntrySeverity)
                                }
                                switch (onDuplicateEntry) {
                                    case OnDuplicateEntry.ignore:
                                        return createDummyRequiredValueHandler()
                                    case OnDuplicateEntry.overwrite:
                                        return onProperty()
                                    default:
                                        return assertUnreachable(onDuplicateEntry)
                                }
                            } else {
                                return onProperty()
                            }

                        }
                        const vh = process()
                        foundProperies.push(propertyData.data.key)
                        return p.value(vh)
                    },
                    objectEnd: endData => {
                        Object.keys(properties).forEach(epName => {
                            if (!foundProperies.includes(epName)) {
                                const ep = properties[epName]
                                if (ep.onNotExists === null) {
                                    raiseError(["missing property", { name: epName }], data.annotation)//FIX print location properly
                                    hasErrors = true
                                } else {
                                    ep.onNotExists({
                                        beginAnnotation: data.annotation,
                                        endAnnotation: endData.annotation,
                                        data: data.data,
                                    })
                                }
                            }
                        })
                        if (onEnd) {
                            onEnd({
                                hasErrors: hasErrors,
                                annotation: endData.annotation,
                            })
                        }
                        return p.value(null)

                    },
                }
            }
        },
        createShorthandTypeHandler: (
            expectedElements,
            onBegin,
            onEnd,
        ) => {
            return typeData => {
                if (onBegin) {
                    onBegin(typeData)
                }
                if (typeData.data.type[0] !== "shorthand type") {
                    raiseWarning(["array is not a shorthand type", {}], typeData.annotation)
                }
                let index = 0
                return {
                    element: () => {
                        const ee = expectedElements[index]
                        index++
                        if (ee === undefined) {
                            const dvh = createDummyValueHandler()
                            return {
                                object: data => {
                                    raiseWarning(["superfluous element", {}], data.annotation)
                                    return dvh.object(data)
                                },
                                array: data => {
                                    raiseWarning(["superfluous element", {}], data.annotation)
                                    return dvh.array(data)
                                },
                                string: data => {
                                    raiseWarning(["superfluous element", {}], data.annotation)
                                    return dvh.string(data)
                                },
                                taggedUnion: data => {
                                    raiseWarning(["superfluous element", {}], data.annotation)
                                    return dvh.taggedUnion(data)
                                },
                            }
                        } else {
                            return ee.getHandler().exists
                        }
                    },
                    arrayEnd: endData => {
                        const missing = expectedElements.length - index
                        if (missing > 0) {
                            raiseError(['elements missing', {
                                names: expectedElements.map(ee => {
                                    return ee.name
                                }),
                            }], endData.annotation)
                            for (let i = index; i !== expectedElements.length; i += 1) {
                                const ee = expectedElements[i]
                                ee.getHandler().missing()
                            }
                        }
                        if (onEnd) {
                            onEnd(endData)
                        }
                        return p.value(null)

                    },
                }
            }
        },
        createListHandler: (
            onElement,
            onBegin,
            onEnd,
        ) => {
            return data => {
                if (data.data.type[0] !== "list") {
                    raiseWarning(["array is not a list", {}], data.annotation)
                }
                if (onBegin) {
                    onBegin(data)
                }
                return {
                    element: () => onElement(),
                    arrayEnd: endData => {
                        if (onEnd) {
                            onEnd(endData)
                        }
                        return p.value(null)

                    },
                }
            }
        },
        createTaggedUnionHandler: (
            options,
            onUnexpectedOption,
            onMissingOption,
        ) => {
            return tuData => {
                return {
                    option: optionData => {

                        const optionHandler = options[optionData.data.option]
                        if (optionHandler === undefined) {
                            raiseError(["unknown option", {
                                "found": optionData.data.option,
                                "valid options": Object.keys(options),
                            }], optionData.annotation)
                            if (onUnexpectedOption !== undefined) {
                                onUnexpectedOption({
                                    tuAnnotation: tuData.annotation,
                                    data: optionData.data,
                                    optionAnnotation: optionData.annotation,
                                })
                            }
                            return createDummyRequiredValueHandler()
                        } else {
                            return optionHandler(tuData, optionData)
                        }

                    },
                    missingOption: onMissingOption ? onMissingOption : (): void => {
                        //
                    },
                    end: () => {
                        //
                    },
                }
            }
        },
        createUnexpectedStringHandler: (
            expected,
            onInvalidType,
            onNull,
        ) => {
            return svData => {
                if (onNull !== undefined && svData.data.type[0] === "nonwrapped" && svData.data.type[1].value === "null") {
                    onNull(svData)
                } else {
                    if (onInvalidType !== undefined && onInvalidType !== null) {
                        onInvalidType({
                            annotation: svData.annotation,
                        })
                    } else {
                        raiseError(["invalid value type", {
                            found: "string",
                            expected: expected,

                        }], svData.annotation)
                    }
                }
                return p.value(false)
            }
        },
        createNullHandler: (
            expected,
            onInvalidType,
        ) => {
            return svData => {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType({
                        annotation: svData.annotation,
                    })
                } else {
                    raiseError(["invalid value type", { found: "string", expected: expected }], svData.annotation)
                }
                return p.value(false)
            }
        },
        createUnexpectedTaggedUnionHandler: (
            expected,
            onInvalidType,
        ) => {
            return () => {
                return {
                    option: $ => {
                        if (onInvalidType !== undefined && onInvalidType !== null) {
                            onInvalidType({
                                annotation: $.annotation,
                            })
                        } else {
                            raiseError(["invalid value type", { found: "tagged union", expected: expected }], $.annotation)
                        }
                        return createDummyRequiredValueHandler()
                    },
                    missingOption: () => {
                        //
                    },
                    end: () => {
                        //
                    },
                }
            }
        },
        createUnexpectedObjectHandler: (
            expected,
            onInvalidType,
        ) => {
            return $ => {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType({
                        annotation: $.annotation,
                    })
                } else {
                    raiseError(
                        ["invalid value type", { found: "object", expected: expected }],
                        $.annotation,
                    )
                }
                return {
                    property: propertyData => {
                        return p.value({
                            exists: createDummyPropertyHandler({
                                key: propertyData.data.key,
                                annotation: propertyData.annotation,
                            }),
                            missing: () => {
                                //
                            },
                        })
                    },
                    objectEnd: _endData => {
                        return p.value(null)
                    },
                }
            }
        },
        createUnexpectedArrayHandler: (
            expected,
            onInvalidType,
        ) => {
            return $ => {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType({
                        annotation: $.annotation,
                    })
                } else {
                    raiseError(
                        ["invalid value type", { found: "array", expected: expected }],
                        $.annotation
                    )
                }
                return {
                    element: () => {
                        return createDummyValueHandler()
                    },
                    arrayEnd: _endData => {
                        return p.value(null)

                    },
                }
            }
        },
    }
}

export function createExpectContext<TokenAnnotation, NonTokenAnnotation>(
    errorHandler: ExpectErrorHandler<TokenAnnotation>,
    warningHandler: ExpectErrorHandler<TokenAnnotation>,
    createDummyPropertyHandler: CreateDummyOnProperty<TokenAnnotation, NonTokenAnnotation>,
    createDummyValueHandler: () => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
    duplicateEntrySeverity: Severity,
    onDuplicateEntry: OnDuplicateEntry,
): IExpectContext<TokenAnnotation, NonTokenAnnotation> {

    function raiseWarning(issue: ExpectError, annotation: TokenAnnotation): void {
        warningHandler({
            issue: issue,
            annotation: annotation,
        })
    }

    const createContext = createCreateContext(
        errorHandler,
        warningHandler,
        createDummyPropertyHandler,
        createDummyValueHandler,
        duplicateEntrySeverity,
        onDuplicateEntry,
    )

    function expectStringImp(
        expected: ExpectErrorValue,
        callback: ($: {
            data: StringValueData
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
    ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {
        return {
            array: createContext.createUnexpectedArrayHandler(expected, onInvalidType),
            object: createContext.createUnexpectedObjectHandler(expected, onInvalidType),
            string: callback,
            taggedUnion: createContext.createUnexpectedTaggedUnionHandler(expected, onInvalidType),
        }
    }

    return {
        expectValue: $ => {
            return {
                exists: $.handler,
                missing: $.onMissing
                    ? $.onMissing
                    : (): void => {
                        //
                    },
            }
        },

        expectNothing: $ => {
            const expectValue: ExpectErrorValue = {
                "type": "nothing",
                "null allowed": false,
            }
            return {
                array: createContext.createUnexpectedArrayHandler(expectValue, $.onInvalidType),
                object: createContext.createUnexpectedObjectHandler(expectValue, $.onInvalidType),
                string: createContext.createUnexpectedStringHandler(expectValue, $.onInvalidType),
                taggedUnion: createContext.createUnexpectedTaggedUnionHandler(expectValue, $.onInvalidType),
            }
        },
        expectString: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "string",
                "null allowed": $.onNull !== undefined,
            }
            return expectStringImp(expectValue, $.callback, $.onInvalidType)
        },
        expectBoolean: $ => {
            const expectValue: ExpectErrorValue = {
                "type": "boolean",
                "null allowed": false,
            }
            return expectStringImp(
                expectValue,
                $$ => {
                    const onError = () => {
                        if ($.onInvalidType) {
                            $.onInvalidType({
                                annotation: $$.annotation,
                            })
                        } else {
                            raiseWarning(["invalid string", { expected: expectValue, found: createSerializedString($$.data, "", "\\n") }], $$.annotation)
                        }
                        return p.value(false)
                    }
                    if ($$.data.type[0] !== "nonwrapped") {
                        return onError()
                    }
                    if ($$.data.type[1].value === "true") {
                        return $.callback({
                            value: true,
                            data: $$.data,
                            annotation: $$.annotation,
                        })
                    }
                    if ($$.data.type[1].value === "false") {
                        return $.callback({
                            value: false,
                            data: $$.data,
                            annotation: $$.annotation,
                        })
                    }
                    return onError()
                },
                $.onInvalidType,
            )
        },
        expectNull: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "null",
                "null allowed": false,
            }
            return expectStringImp(
                expectValue,
                $$ => {
                    const isNull = $$.data.type[0] === "nonwrapped"
                        && $$.data.type[1].value === "null"
                    if (!isNull) {
                        if ($.onInvalidType) {
                            $.onInvalidType({
                                annotation: $$.annotation,
                            })
                        } else {
                            raiseWarning(["invalid string", { expected: expectValue, found: createSerializedString($$.data, "", "\\n") }], $$.annotation)
                        }
                        return p.value(false)
                    }
                    return $.callback($$)
                },
                $.onInvalidType,
            )
        },
        expectNumber: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "number",
                "null allowed": $.onNull !== undefined,
            }
            return expectStringImp(
                expectValue,
                $$ => {
                    const onError = () => {
                        if ($.onInvalidType) {
                            $.onInvalidType({
                                annotation: $$.annotation,
                            })
                        } else {
                            raiseWarning(["not a valid number", { value: createSerializedString($$.data, "", "\\n") }], $$.annotation)
                        }
                        return p.value(false)
                    }
                    if ($$.data.type[0] !== "nonwrapped") {
                        return onError()
                    }
                    //eslint-disable-next-line
                    const nr = new Number($$.data.type[1].value).valueOf()
                    if (isNaN(nr)) {
                        return onError()
                    }
                    return $.callback({
                        value: nr,
                        data: $$.data,
                        annotation: $$.annotation,
                    })
                },
                $.onInvalidType
            )
        },
        expectQuotedString: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "quoted string",
                "null allowed": $.onNull !== undefined,
            }
            return expectStringImp(
                expectValue,
                $$ => {
                    const onError = () => {
                        if ($.onInvalidType) {
                            $.onInvalidType({
                                annotation: $$.annotation,
                            })
                        } else {
                            raiseWarning(["not a quoted string", {}], $$.annotation)
                        }
                        return p.value(false)
                    }
                    if ($$.data.type[0] !== "quoted") {
                        return onError()
                    }
                    return $.callback({
                        value: $$.data.type[1].value,
                        data: $$.data,
                        annotation: $$.annotation,
                    })
                },
                $.onInvalidType
            )
        },
        expectDictionary: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "dictionary",
                "null allowed": false,
            }
            return {
                array: createContext.createUnexpectedArrayHandler(expectValue, $.onInvalidType),
                object: createContext.createDictionaryHandler($.onProperty, $.onBegin, $.onEnd),
                string: createContext.createUnexpectedStringHandler(expectValue, $.onInvalidType),
                taggedUnion: createContext.createUnexpectedTaggedUnionHandler(expectValue, $.onInvalidType),
            }
        },
        expectType: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "number",
                "null allowed": $.onNull !== undefined,
            }
            return {
                array: createContext.createUnexpectedArrayHandler(expectValue, $.onInvalidType),
                object: createContext.createTypeHandler(
                    $.properties,
                    $.onBegin,
                    $.onEnd,
                    $.onUnexpectedProperty
                ),
                string: createContext.createUnexpectedStringHandler(expectValue, $.onInvalidType, $.onNull),
                taggedUnion: createContext.createUnexpectedTaggedUnionHandler(expectValue, $.onInvalidType),
            }
        },
        expectList: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "list",
                "null allowed": false,
            }
            return {
                array: createContext.createListHandler($.onElement, $.onBegin, $.onEnd),
                object: createContext.createUnexpectedObjectHandler(expectValue, $.onInvalidType),
                string: createContext.createUnexpectedStringHandler(expectValue, $.onInvalidType),
                taggedUnion: createContext.createUnexpectedTaggedUnionHandler(expectValue, $.onInvalidType),
            }
        },
        expectShorthandType: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "shorthand type",
                "null allowed": $.onNull !== undefined,
            }
            return {
                array: createContext.createShorthandTypeHandler($.elements, $.onBegin, $.onEnd),
                object: createContext.createUnexpectedObjectHandler(expectValue, $.onInvalidType),
                string: createContext.createUnexpectedStringHandler(expectValue, $.onInvalidType, $.onNull),
                taggedUnion: createContext.createUnexpectedTaggedUnionHandler(expectValue, $.onInvalidType),
            }
        },

        expectTypeOrShorthandType: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "type or shorthand type",
                "null allowed": $.onNull !== undefined,
            }
            return {
                array: createContext.createShorthandTypeHandler($.elements, $.onShorthandTypeBegin, $.onShorthandTypeEnd),
                object: createContext.createTypeHandler(
                    $.properties,
                    $.onTypeBegin,
                    $.onTypeEnd,
                    $.onUnexpectedProperty
                ),
                string: createContext.createUnexpectedStringHandler(expectValue, $.onInvalidType, $.onNull),
                taggedUnion: createContext.createUnexpectedTaggedUnionHandler(expectValue, $.onInvalidType),
            }
        },
        expectTaggedUnion: $ => {

            const expectValue: ExpectErrorValue = {
                "type": "tagged union",
                "null allowed": $.onNull !== undefined,
            }
            return {
                array: createContext.createUnexpectedArrayHandler(expectValue, $.onInvalidType),
                object: createContext.createUnexpectedObjectHandler(expectValue, $.onInvalidType),
                string: createContext.createUnexpectedStringHandler(expectValue, $.onInvalidType, $.onNull),
                taggedUnion: createContext.createTaggedUnionHandler(
                    $.options,
                    $.onUnexpectedOption,
                    $.onMissingOption,
                ),
            }
        },
    }
}