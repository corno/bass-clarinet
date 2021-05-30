/* eslint
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as astn from "../.."
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
} from "./functions"
import { createSerializedString } from "../../formatting"
import { ArrayData, OptionData, ObjectData, PropertyData, StringValueData } from "../../interfaces/handlers"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type CreateDummyOnProperty<TokenAnnotation, NonTokenAnnotation> = ($: {
    key: string
    annotation: TokenAnnotation
}) => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>


export function createExpectContext<TokenAnnotation, NonTokenAnnotation>(
    errorHandler: ExpectErrorHandler<TokenAnnotation>,
    warningHandler: ExpectErrorHandler<TokenAnnotation>,
    //createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler,
    //createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler,
    createDummyPropertyHandler: CreateDummyOnProperty<TokenAnnotation, NonTokenAnnotation>,
    createDummyValueHandler: () => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
    duplcateEntrySeverity: Severity,
    onDuplicateEntry: OnDuplicateEntry,
): IExpectContext<TokenAnnotation, NonTokenAnnotation> {
    class ExpectContext implements IExpectContext<TokenAnnotation, NonTokenAnnotation> {
        private readonly errorHandler: ExpectErrorHandler<TokenAnnotation>
        private readonly warningHandler: ExpectErrorHandler<TokenAnnotation>
        //private readonly createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler
        //private readonly createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler
        private readonly createDummyOnProperty: CreateDummyOnProperty<TokenAnnotation, NonTokenAnnotation>
        private readonly createDummyValueHandler: () => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>
        private readonly createDummyRequiredValueHandler: () => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
        private readonly duplicateEntrySeverity: Severity
        private readonly onDuplicateEntry: OnDuplicateEntry
        constructor(
        ) {
            this.errorHandler = errorHandler
            this.warningHandler = warningHandler
            //this.createDummyArrayHandler = createDummyArrayHandler
            //this.createDummyObjectHandler = createDummyObjectHandler
            this.createDummyOnProperty = createDummyPropertyHandler
            this.createDummyValueHandler = createDummyValueHandler
            this.duplicateEntrySeverity = duplcateEntrySeverity
            this.onDuplicateEntry = onDuplicateEntry
            this.createDummyRequiredValueHandler = () => {
                return {
                    exists: this.createDummyValueHandler(),
                    missing: () => {
                        //
                    },
                }
            }
        }
        public raiseWarning(issue: ExpectError, annotation: TokenAnnotation): void {
            this.warningHandler({
                issue: issue,
                annotation: annotation,
            })
        }
        public raiseError(issue: ExpectError, annotation: TokenAnnotation): void {
            this.errorHandler({
                issue: issue,
                annotation: annotation,
            })
        }
        public createDictionaryHandler(
            onEntry: ($: {
                data: PropertyData
                annotation: TokenAnnotation
            }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
            onBegin?: ($: {
                data: ObjectData
                annotation: TokenAnnotation
            }) => void,
            onEnd?: ($: {
                annotation: TokenAnnotation
            }) => void,
        ): astn.OnObject<TokenAnnotation, NonTokenAnnotation> {
            return data => {

                if (data.data.type[0] !== "dictionary") {
                    this.raiseWarning(["object is not a dictionary", {}], data.annotation)
                }
                if (onBegin) {
                    onBegin(data)
                }
                const foundEntries: string[] = []
                return {
                    property: propertyData => {
                        const process = (): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> => {
                            if (foundEntries.includes(propertyData.data.key)) {
                                switch (this.duplicateEntrySeverity) {
                                    case Severity.error:
                                        this.raiseError(["duplicate entry", { key: propertyData.data.key }], propertyData.annotation)
                                        break
                                    case Severity.nothing:
                                        break
                                    case Severity.warning:
                                        this.raiseWarning(["duplicate entry", { key: propertyData.data.key }], propertyData.annotation)
                                        break
                                    default:
                                        assertUnreachable(this.duplicateEntrySeverity)
                                }
                                switch (this.onDuplicateEntry) {
                                    case OnDuplicateEntry.ignore:
                                        return this.createDummyRequiredValueHandler()
                                    case OnDuplicateEntry.overwrite:
                                        return onEntry(propertyData)
                                    default:
                                        return assertUnreachable(this.onDuplicateEntry)
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
        }
        public createTypeHandler(
            expectedProperties: ExpectedProperties<TokenAnnotation, NonTokenAnnotation>,
            onBegin?: ($: {
                data: ObjectData
                annotation: TokenAnnotation
            }) => void,
            onEnd?: ($: {
                hasErrors: boolean
                annotation: TokenAnnotation
            }) => void,
            onUnexpectedProperty?: ($: {
                data: PropertyData
                annotation: TokenAnnotation
            }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
        ): astn.OnObject<TokenAnnotation, NonTokenAnnotation> {
            return data => {

                if (data.data.type[0] !== "verbose type") {
                    this.raiseWarning(["object is not a verbose type", {}], data.annotation)
                }
                if (onBegin) {
                    onBegin(data)
                }
                const foundProperies: string[] = []
                let hasErrors = false
                return {
                    property: propertyData => {
                        const onProperty = (): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> => {
                            const expected = expectedProperties[propertyData.data.key]
                            if (expected === undefined) {
                                hasErrors = true
                                this.raiseError(["unexpected property", {
                                    "found key": propertyData.data.key,
                                    "valid keys": Object.keys(expectedProperties).sort(),
                                }], propertyData.annotation)
                                if (onUnexpectedProperty !== undefined) {
                                    return onUnexpectedProperty(propertyData)
                                } else {
                                    return {
                                        exists: this.createDummyOnProperty({
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
                                switch (this.duplicateEntrySeverity) {
                                    case Severity.error:
                                        this.raiseError(["duplicate property", { name: propertyData.data.key }], propertyData.annotation)
                                        break
                                    case Severity.nothing:
                                        break
                                    case Severity.warning:
                                        this.raiseWarning(["duplicate property", { name: propertyData.data.key }], propertyData.annotation)
                                        break
                                    default:
                                        return assertUnreachable(this.duplicateEntrySeverity)
                                }
                                switch (this.onDuplicateEntry) {
                                    case OnDuplicateEntry.ignore:
                                        return this.createDummyRequiredValueHandler()
                                    case OnDuplicateEntry.overwrite:
                                        return onProperty()
                                    default:
                                        return assertUnreachable(this.onDuplicateEntry)
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
                        Object.keys(expectedProperties).forEach(epName => {
                            if (!foundProperies.includes(epName)) {
                                const ep = expectedProperties[epName]
                                if (ep.onNotExists === null) {
                                    this.raiseError(["missing property", { name: epName }], data.annotation)//FIX print location properly
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
        }
        public createShorthandTypeHandler(
            expectedElements: ExpectedElements<TokenAnnotation, NonTokenAnnotation>,
            onBegin?: ($: {
                data: ArrayData
                annotation: TokenAnnotation
            }) => void,
            onEnd?: ($: {
                annotation: TokenAnnotation
            }) => void
        ): astn.OnArray<TokenAnnotation, NonTokenAnnotation> {
            return typeData => {
                if (onBegin) {
                    onBegin(typeData)
                }
                if (typeData.data.type[0] !== "shorthand type") {
                    this.raiseWarning(["array is not a shorthand type", {}], typeData.annotation)
                }
                let index = 0
                return {
                    element: () => {
                        const ee = expectedElements[index]
                        index++
                        if (ee === undefined) {
                            const dvh = this.createDummyValueHandler()
                            return {
                                object: data => {
                                    this.raiseError(["superfluous element", {}], data.annotation)
                                    return dvh.object(data)
                                },
                                array: data => {
                                    this.raiseError(["superfluous element", {}], data.annotation)
                                    return dvh.array(data)
                                },
                                string: data => {
                                    this.raiseError(["superfluous element", {}], data.annotation)
                                    return dvh.string(data)
                                },
                                taggedUnion: data => {
                                    this.raiseError(["superfluous element", {}], data.annotation)
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
                            this.raiseError(['elements missing', {
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
        }
        public createListHandler(
            onElement: () => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
            onBegin?: ($: {
                data: ArrayData
                annotation: TokenAnnotation
            }) => void,
            onEnd?: ($: {
                annotation: TokenAnnotation
            }) => void,
        ): astn.OnArray<TokenAnnotation, NonTokenAnnotation> {
            return data => {
                if (data.data.type[0] !== "list") {
                    this.raiseWarning(["array is not a list", {}], data.annotation)
                }
                if (onBegin) {
                    onBegin(data)
                }
                return {
                    element: (): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> => onElement(),
                    arrayEnd: endData => {
                        if (onEnd) {
                            onEnd(endData)
                        }
                        return p.value(null)

                    },
                }
            }
        }
        // public createTaggedUnionSurrogateHandler(
        //     options: Options
        // ): bc.OnArray {
        //     return (beginMetaData, beginComments) => {
        //         let dataHandler: bc.ValueHandler | null = null
        //         return {
        //             element: () => {
        //                 return {
        //                     array: (metaData, comments) => {
        //                         if (dataHandler === null) {
        //                             this.raiseError(`unexected array`, metaData.start)
        //                             return this.createDummyArrayHandler(metaData)
        //                         }
        //                         const dh = dataHandler
        //                         dataHandler = null
        //                         return dh.array(metaData, comments)
        //                     },
        //                     object: (metaData, comments) => {
        //                         if (dataHandler === null) {
        //                             this.raiseError(`unexected object`, metaData.start)
        //                             return this.createDummyObjectHandler(metaData)
        //                         }
        //                         const dh = dataHandler
        //                         dataHandler = null
        //                         return dh.object(metaData, comments)
        //                     },
        //                     // nonwrappedString: (value, metaData) => {
        //                     //     if (dataHandler === null) {
        //                     //         return this.raiseError(`expected string`, dataRange)
        //                     //     } else {
        //                     //         dataHandler.nonwrappedString(value, dataRange, dataComments, pauser)
        //                     //     }
        //                     // },
        //                     string: (value, metaData, optionComments) => {
        //                         if (dataHandler === null) {
        //                             //found the option
        //                             const optionHandler = options[value]
        //                             if (optionHandler === undefined) {
        //                                 return this.raiseError(`unknown option: '${value}'`, metaData.annotation)
        //                             }
        //                             dataHandler = optionHandler(
        //                                 {
        //                                     start: beginMetaData.start,
        //                                     optionRange: metaData.annotation,
        //                                     pauser: metaData.pauser,
        //                                 },
        //                                 beginComments,
        //                                 optionComments,
        //                             )
        //                         } else {
        //                             //found the value
        //                             dataHandler.string(value, metaData, optionComments)
        //                         }
        //                     },
        //                     taggedUnion: (option, metaData) => {
        //                         if (dataHandler === null) {
        //                             this.raiseError(`unexected tagged union`, metaData.start)
        //                             return this.createDummyValueHandler()
        //                         }
        //                         const dh = dataHandler
        //                         dataHandler = null
        //                         return dh.taggedUnion(option, metaData)
        //                     },
        //                 }
        //             },
        //             end: endMetaData => {
        //                 if (dataHandler === null) {
        //                     this.raiseError(`missing option`, endMetaData.end)
        //                 }
        //             },
        //         }
        //     }
        // }
        public createTaggedUnionHandler(
            options: Options<TokenAnnotation, NonTokenAnnotation>,
            onUnexpectedOption?: ($: {
                tuAnnotation: TokenAnnotation
                data: OptionData
                optionAnnotation: TokenAnnotation
            }) => void,
            onMissingOption?: () => void,
        ): astn.OnTaggedUnion<TokenAnnotation, NonTokenAnnotation> {
            return tuData => {
                return {
                    option: optionData => {

                        const optionHandler = options[optionData.data.option]
                        if (optionHandler === undefined) {
                            this.raiseError(["unknown option", { "found": optionData.data.option, "valid options": Object.keys(options) }], optionData.annotation)
                            if (onUnexpectedOption !== undefined) {
                                onUnexpectedOption({
                                    tuAnnotation: tuData.annotation,
                                    data: optionData.data,
                                    optionAnnotation: optionData.annotation,
                                })
                            }
                            return this.createDummyRequiredValueHandler()
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
        }
        public createUnexpectedStringHandler(
            expected: ExpectErrorValue,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
            onNull?: ($: {
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
        ): astn.OnString<TokenAnnotation> {
            return svData => {
                if (onNull !== undefined && svData.data.type[0] === "nonwrapped" && svData.data.type[1].value === "null") {
                    onNull(svData)
                } else {
                    if (onInvalidType !== undefined && onInvalidType !== null) {
                        onInvalidType({
                            annotation: svData.annotation,
                        })
                    } else {
                        this.raiseError(["invalid value type", {
                            found: "string",
                            expected: expected,

                        }], svData.annotation)
                    }
                }
                return p.value(false)
            }
        }
        public createNullHandler(
            expected: ExpectErrorValue,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.OnString<TokenAnnotation> {
            return svData => {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType({
                        annotation: svData.annotation,
                    })
                } else {
                    this.raiseError(["invalid value type", { found: "string", expected: expected }], svData.annotation)
                }
                return p.value(false)
            }
        }
        public createUnexpectedTaggedUnionHandler(
            expected: ExpectErrorValue,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.OnTaggedUnion<TokenAnnotation, NonTokenAnnotation> {
            return (): astn.TaggedUnionHandler<TokenAnnotation, NonTokenAnnotation> => {
                return {
                    option: $ => {
                        if (onInvalidType !== undefined && onInvalidType !== null) {
                            onInvalidType({
                                annotation: $.annotation,
                            })
                        } else {
                            this.raiseError(["invalid value type", { found: "tagged union", expected: expected }], $.annotation)
                        }
                        return this.createDummyRequiredValueHandler()
                    },
                    missingOption: (): void => {
                        //
                    },
                    end: () => {
                        //
                    },
                }
            }
        }
        public createUnexpectedObjectHandler(
            expected: ExpectErrorValue,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.OnObject<TokenAnnotation, NonTokenAnnotation> {
            return $ => {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType({
                        annotation: $.annotation,
                    })
                } else {
                    this.raiseError(
                        ["invalid value type", { found: "object", expected: expected }],
                        $.annotation,
                    )
                }
                return {
                    property: propertyData => {
                        return p.value({
                            exists: this.createDummyOnProperty({
                                key: propertyData.data.key,
                                annotation: propertyData.annotation,
                            }),
                            missing: (): void => {
                                //
                            },
                        })
                    },
                    objectEnd: _endData => {
                        return p.value(null)
                    },
                }
            }
        }
        public createUnexpectedArrayHandler(
            expected: ExpectErrorValue,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.OnArray<TokenAnnotation, NonTokenAnnotation> {
            return $ => {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType({
                        annotation: $.annotation,
                    })
                } else {
                    this.raiseError(
                        ["invalid value type", { found: "array", expected: expected }],
                        $.annotation
                    )
                }
                return {
                    element: (): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> => {
                        return this.createDummyValueHandler()
                    },
                    arrayEnd: _endData => {
                        return p.value(null)

                    },
                }
            }
        }
        public expectNothing(
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {
            const expectValue: ExpectErrorValue = {
                "type": "nothing",
                "null allowed": false,
            }
            return {
                array: this.createUnexpectedArrayHandler(expectValue, onInvalidType),
                object: this.createUnexpectedObjectHandler(expectValue, onInvalidType),
                string: this.createUnexpectedStringHandler(expectValue, onInvalidType),
                taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
            }
        }
        public expectStringImp(
            expected: ExpectErrorValue,
            callback: ($: {
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {
            return {
                array: this.createUnexpectedArrayHandler(expected, onInvalidType),
                object: this.createUnexpectedObjectHandler(expected, onInvalidType),
                string: callback,
                taggedUnion: this.createUnexpectedTaggedUnionHandler(expected, onInvalidType),
            }
        }
        public expectString(
            callback: ($: {
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
            onNull?: ($: {
                data: astn.StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "string",
                "null allowed": onNull !== undefined,
            }
            return this.expectStringImp(expectValue, callback, onInvalidType)
        }
        public expectBoolean(
            callback: ($: {
                value: boolean
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {
            const expectValue: ExpectErrorValue = {
                "type": "boolean",
                "null allowed": false,
            }
            return this.expectStringImp(
                expectValue,
                $ => {
                    const onError = () => {
                        if (onInvalidType) {
                            onInvalidType({
                                annotation: $.annotation,
                            })
                        } else {
                            this.raiseError(["invalid string", { expected: expectValue, found: createSerializedString($.data, "", "\\n") }], $.annotation)
                        }
                        return p.value(false)
                    }
                    if ($.data.type[0] !== "nonwrapped") {
                        return onError()
                    }
                    if ($.data.type[1].value === "true") {
                        return callback({
                            value: true,
                            data: $.data,
                            annotation: $.annotation,
                        })
                    }
                    if ($.data.type[1].value === "false") {
                        return callback({
                            value: false,
                            data: $.data,
                            annotation: $.annotation,
                        })
                    }
                    return onError()
                },
                onInvalidType,
            )
        }
        public expectNull(
            callback: ($: {
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "null",
                "null allowed": false,
            }
            return this.expectStringImp(
                expectValue,
                $ => {
                    const isNull = $.data.type[0] === "nonwrapped"
                        && $.data.type[1].value === "null"
                    if (!isNull) {
                        if (onInvalidType) {
                            onInvalidType({
                                annotation: $.annotation,
                            })
                        } else {
                            this.raiseError(["invalid string", { expected: expectValue, found: createSerializedString($.data, "", "\\n") }], $.annotation)
                        }
                        return p.value(false)
                    }
                    return callback($)
                },
                onInvalidType,
            )
        }
        public expectValue(
            onValue: astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
            onMissing?: () => void,
        ): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> {
            return {
                exists: onValue,
                missing: onMissing
                    ? onMissing
                    : (): void => {
                        //
                    },
            }
        }
        public expectNumber(
            callback: ($: {
                value: number
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
            onNull?: ($: {
                data: astn.StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "number",
                "null allowed": onNull !== undefined,
            }
            return this.expectStringImp(
                expectValue,
                $ => {
                    const onError = () => {
                        if (onInvalidType) {
                            onInvalidType({
                                annotation: $.annotation,
                            })
                        } else {
                            this.raiseError(["not a valid number", { value: createSerializedString($.data, "", "\\n") }], $.annotation)
                        }
                        return p.value(false)
                    }
                    if ($.data.type[0] !== "nonwrapped") {
                        return onError()
                    }
                    //eslint-disable-next-line
                    const nr = new Number($.data.type[1].value).valueOf()
                    if (isNaN(nr)) {
                        return onError()
                    }
                    return callback({
                        value: nr,
                        data: $.data,
                        annotation: $.annotation,
                    })
                },
                onInvalidType
            )
        }
        public expectQuotedString(
            callback: ($: {
                value: string
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
            onNull?: ($: {
                data: astn.StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "quoted string",
                "null allowed": onNull !== undefined,
            }
            return this.expectStringImp(
                expectValue,
                $ => {
                    const onError = () => {
                        if (onInvalidType) {
                            onInvalidType({
                                annotation: $.annotation,
                            })
                        } else {
                            this.raiseError(["not a quoted string", {}], $.annotation)
                        }
                        return p.value(false)
                    }
                    if ($.data.type[0] !== "quoted") {
                        return onError()
                    }
                    return callback({
                        value: $.data.type[1].value,
                        data: $.data,
                        annotation: $.annotation,
                    })
                },
                onInvalidType
            )
        }
        public expectDictionary(
            onBegin: ($: {
                data: ObjectData
                annotation: TokenAnnotation
            }) => void,
            onProperty: ($: {
                data: PropertyData
                annotation: TokenAnnotation
            }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
            onEnd: ($: {
                annotation: TokenAnnotation
            }) => void,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "dictionary",
                "null allowed": false,
            }
            return {
                array: this.createUnexpectedArrayHandler(expectValue, onInvalidType),
                object: this.createDictionaryHandler(onProperty, onBegin, onEnd),
                string: this.createUnexpectedStringHandler(expectValue, onInvalidType),
                taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
            }
        }
        public expectType(
            expectedProperties: ExpectedProperties<TokenAnnotation, NonTokenAnnotation> = {},
            onBegin?: ($: {
                data: ObjectData
                annotation: TokenAnnotation
            }) => void,
            onEnd?: ($: {
                hasErrors: boolean
                annotation: TokenAnnotation
            }) => void,
            onUnexpectedProperty?: ($: {
                data: PropertyData
                annotation: TokenAnnotation
            }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
            onNull?: ($: {
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "number",
                "null allowed": onNull !== undefined,
            }
            return {
                array: this.createUnexpectedArrayHandler(expectValue, onInvalidType),
                object: this.createTypeHandler(
                    expectedProperties,
                    onBegin,
                    onEnd,
                    onUnexpectedProperty
                ),
                string: this.createUnexpectedStringHandler(expectValue, onInvalidType, onNull),
                taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
            }
        }
        public expectList(
            onBegin: ($: {
                data: ArrayData
                annotation: TokenAnnotation
            }) => void,
            onElement: () => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
            onEnd: ($: {
                annotation: TokenAnnotation
            }) => void,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "list",
                "null allowed": false,
            }
            return {
                array: this.createListHandler(onElement, onBegin, onEnd),
                object: this.createUnexpectedObjectHandler(expectValue, onInvalidType),
                string: this.createUnexpectedStringHandler(expectValue, onInvalidType),
                taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
            }
        }
        public expectShorthandType(
            expectedElements: ExpectedElements<TokenAnnotation, NonTokenAnnotation>,
            onBegin?: ($: {
                data: ArrayData
                annotation: TokenAnnotation
            }) => void,
            onEnd?: ($: {
                annotation: TokenAnnotation
            }) => void,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
            onNull?: ($: {
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "shorthand type",
                "null allowed": onNull !== undefined,
            }
            return {
                array: this.createShorthandTypeHandler(expectedElements, onBegin, onEnd),
                object: this.createUnexpectedObjectHandler(expectValue, onInvalidType),
                string: this.createUnexpectedStringHandler(expectValue, onInvalidType, onNull),
                taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
            }
        }

        public expectTypeOrShorthandType(
            expectedProperties: ExpectedProperties<TokenAnnotation, NonTokenAnnotation> = {},
            expectedElements: ExpectedElements<TokenAnnotation, NonTokenAnnotation>,
            onTypeBegin?: ($: {
                data: ObjectData
                annotation: TokenAnnotation
            }) => void,
            onTypeEnd?: ($: {
                hasErrors: boolean
                annotation: TokenAnnotation
            }) => void,
            onUnexpectedProperty?: ($: {
                data: PropertyData
                annotation: TokenAnnotation
            }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
            onShorthandTypeBegin?: ($: {
                data: ArrayData
                annotation: TokenAnnotation
            }) => void,
            onShorthandTypeEnd?: ($: {
                annotation: TokenAnnotation
            }) => void,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
            onNull?: ($: {
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "type or shorthand type",
                "null allowed": onNull !== undefined,
            }
            return {
                array: this.createShorthandTypeHandler(expectedElements, onShorthandTypeBegin, onShorthandTypeEnd),
                object: this.createTypeHandler(
                    expectedProperties,
                    onTypeBegin,
                    onTypeEnd,
                    onUnexpectedProperty
                ),
                string: this.createUnexpectedStringHandler(expectValue, onInvalidType, onNull),
                taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
            }
        }
        public expectTaggedUnion(
            options: Options<TokenAnnotation, NonTokenAnnotation>,
            onUnexpectedOption?: ($: {
                tuAnnotation: TokenAnnotation
                data: OptionData
                optionAnnotation: TokenAnnotation
            }) => void,
            onMissingOption?: () => void,
            onInvalidType?: OnInvalidType<TokenAnnotation>,
            onNull?: ($: {
                data: StringValueData
                annotation: TokenAnnotation
            }) => p.IValue<boolean>,
        ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

            const expectValue: ExpectErrorValue = {
                "type": "tagged union",
                "null allowed": onNull !== undefined,
            }
            return {
                array: this.createUnexpectedArrayHandler(expectValue, onInvalidType),
                object: this.createUnexpectedObjectHandler(expectValue, onInvalidType),
                string: this.createUnexpectedStringHandler(expectValue, onInvalidType, onNull),
                taggedUnion: this.createTaggedUnionHandler(
                    options,
                    onUnexpectedOption,
                    onMissingOption,
                ),
            }
        }
        // /**
        //  * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
        //  * @param callback
        //  */
        // public expectTaggedUnionOrArraySurrogate(
        //     options: Options
        // ): bc.ValueHandler {
        //     return {
        //         array: this.createTaggedUnionSurrogateHandler(options),
        //         object: this.createUnexpectedObjectHandler("tagged union"),
        //         string: this.createUnexpectedStringHandler("tagged union"),
        //         taggedUnion: this.createTaggedUnionHandler(options),
        //     }
        // }
    }
    return new ExpectContext()
}