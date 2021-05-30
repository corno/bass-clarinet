/* eslint
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as astn from ".."
import { createSerializedString } from "../formatting"
import { ArrayData, OptionData, ObjectData, PropertyData, StringData2 } from "../handlers"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
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

export type ExpectError =
    | ["array is not a list", {
        //
    }]
    | ["array is not a shorthand type", {
        //
    }]

    | ["object is not a verbose type", {
        //
    }]

    | ["object is not a dictionary", {
        //
    }]
    | ["invalid value type", {
        found: ExpectErrorValueType
        expected: ExpectErrorValue
    }]
    | ["invalid string", {
        found: string
        expected: ExpectErrorValue
    }]
    | ["expected token", {
        token: ExpectedToken
        found: string
    }]
    | ["duplicate entry", {
        key: string
    }]
    | ["duplicate property", {
        name: string
    }]
    | ["missing property", {
        name: string
    }]
    | ["unexpected property", {
        "found key": string
        "valid keys": string[]
    }]
    | ["not a valid number", {
        value: string
    }]
    | ["not a quoted string", {
    }]
    | ["superfluous element", {
    }]
    | ["elements missing", {
        names: string[]
    }]
    | ["unknown option", {
        "found": string
        "valid options": string[]
    }]

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

export function printExpectErrorValueType(vt: ExpectErrorValueType): string {
    switch (vt) {
        case "array": {
            return `an array ([] or <>)`
        }
        case "shorthand type": {
            return `a shorhand type (<>)`
        }
        case "boolean": {
            return `a boolean (true/false)`
        }
        case "dictionary": {
            return `a dictionary ( {} )`
        }
        case "list": {
            return `a list ( [] )`
        }
        case "nothing": {
            return `nothing`
        }
        case "null": {
            return `'null'`
        }
        case "number": {
            return `a number`
        }
        case "object": {
            return `an object ( {} or () )`
        }
        case "string": {
            return `a string (quoted, apostrophed, multiline or non wrapped (including a number, a keyword, a boolean)`
        }
        case "quoted string": {
            return `a string with quotes`
        }
        case "tagged union": {
            return `a tagged union ( | "statename" data )`
        }
        case "type": {
            return `a type ( () )`
        }
        case "type or shorthand type": {
            return `a type ( () ) or a shorhand type (<>)`
        }
        default:
            return assertUnreachable(vt[0])
    }
}

export function printExpectErrorValue(vt: ExpectErrorValue): string {
    return `${printExpectErrorValueType(vt.type)}${vt["null allowed"] ? 'or null' : ''}`
}

export function printExpectError(issue: ExpectError): string {
    switch (issue[0]) {
        case "array is not a list": {
            return `expected a list: [ ]`
        }
        case "array is not a shorthand type": {
            return `expected a shorthand type: < >`
        }
        case "object is not a dictionary": {
            return `expected a dictionary: { }`
        }
        case "object is not a verbose type": {
            return `expected a verbose type: ( )`
        }
        case "invalid value type": {
            const $ = issue[1]
            return `expected ${printExpectErrorValue($.expected)} but found ${printExpectErrorValueType($.found)}`
        }
        case "invalid string": {
            const $ = issue[1]
            return `expected '${printExpectErrorValue($.expected)}' but found '${$.found}'`
        }
        case "duplicate property": {
            const $ = issue[1]
            return `duplicate property: '${$.name}'`
        }
        case "missing property": {
            const $ = issue[1]
            return `missing property: '${$.name}'`
        }
        case "unexpected property": {
            const $ = issue[1]
            return `unexpected property: '${$["found key"]}'. Choose from ${$["valid keys"].map($ => `'${$}'`).join(", ")}`
        }
        case "duplicate entry": {
            const $ = issue[1]
            return `duplicate entry: '${$.key}'`
        }
        case "expected token": {
            const $ = issue[1]
            const val = ((): string => {
                switch ($.token) {
                    case "open angle bracket": {
                        return '<'
                    }
                    case "open bracket": {
                        return '['
                    }
                    case "close bracket": {
                        return ']'
                    }
                    case "close angle bracket": {
                        return '>'
                    }
                    case "open curly": {
                        return '{'
                    }
                    case "close curly": {
                        return '}'
                    }
                    case "open paren": {
                        return '('
                    }
                    case "close paren": {
                        return ')'
                    }
                    default:
                        return assertUnreachable($.token[0])
                }
            })()
            return `expected '${val}' but found '${$.found}'`
        }
        case "not a valid number": {
            const $ = issue[1]
            return `'${$.value}' is not a valid number`
        }
        case "not a quoted string": {
            // const $ = issue[1]
            return `not a quoted string`
        }
        case "superfluous element": {
            //const $ = issue[1]
            return `superfluous element`
        }
        case "elements missing": {
            const $ = issue[1]
            return `${$.names.length} missing element(s): ${$.names.map($ => `'${$}'`).join(", ")}`
        }
        case "unknown option": {
            const $ = issue[1]
            return `unknown option '${$.found}', choose from ${$["valid options"].map($ => `'${$}'`).join(", ")} `
        }
        default:
            return assertUnreachable(issue[0])
    }
}

export type ExpectErrorHandler<TokenAnnotation> = (issue: ExpectError, annotation: TokenAnnotation) => void

export type ExpectedElement<TokenAnnotation, NonTokenAnnotation> = {
    name: string
    getHandler: (() => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>)
}

export type ExpectedElements<TokenAnnotation, NonTokenAnnotation> = ExpectedElement<TokenAnnotation, NonTokenAnnotation>[]

export type ExpectedProperty<TokenAnnotation, NonTokenAnnotation> = {
    onExists: ($: {
        data: PropertyData
        annotation: TokenAnnotation
    }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
    onNotExists: null | (($: {
        data: ObjectData
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
            data: OptionData
            annotation: TokenAnnotation
        },
    ) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
}

export enum Severity {
    warning,
    error,
    nothing
}
export enum OnDuplicateEntry {
    ignore,
    overwrite
}

type OnInvalidType<TokenAnnotation> = null | ((annotation: TokenAnnotation) => void)

export class ExpectContext<TokenAnnotation, NonTokenAnnotation> {
    private readonly errorHandler: ExpectErrorHandler<TokenAnnotation>
    private readonly warningHandler: ExpectErrorHandler<TokenAnnotation>
    //private readonly createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler
    //private readonly createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler
    private readonly createDummyOnProperty: (key: string, annotation: TokenAnnotation) => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    private readonly createDummyValueHandler: () => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>
    private readonly createDummyRequiredValueHandler: () => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
    private readonly duplicateEntrySeverity: Severity
    private readonly onDuplicateEntry: OnDuplicateEntry
    constructor(
        errorHandler: ExpectErrorHandler<TokenAnnotation>,
        warningHandler: ExpectErrorHandler<TokenAnnotation>,
        //createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler,
        //createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler,
        createDummyPropertyHandler: (key: string, annotation: TokenAnnotation) => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
        createDummyValueHandler: () => astn.ValueHandler<TokenAnnotation, NonTokenAnnotation>,
        duplcateEntrySeverity: Severity,
        onDuplicateEntry: OnDuplicateEntry,
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
        this.warningHandler(issue, annotation)
    }
    public raiseError(issue: ExpectError, annotation: TokenAnnotation): void {
        this.errorHandler(issue, annotation)
    }
    public createDictionaryHandler(
        onEntry: (propertyData: {
            data: PropertyData
            annotation: TokenAnnotation
        }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onBegin?: ($: {
            data: ObjectData
            annotation: TokenAnnotation
        }) => void,
        onEnd?: (endData: {
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
                                    exists: this.createDummyOnProperty(propertyData.data.key, propertyData.annotation),
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
        onEnd?: (endData: {
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
        onEnd?: (endData: {
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
        }
        ) => void,
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
            data: StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
    ): astn.OnString<TokenAnnotation> {
        return svData => {
            if (onNull !== undefined && svData.data.type[0] === "nonwrapped" && svData.data.type[1].value === "null") {
                onNull(svData)
            } else {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType(svData.annotation)
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
                onInvalidType(svData.annotation)
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
                option: optionData => {
                    if (onInvalidType !== undefined && onInvalidType !== null) {
                        onInvalidType(optionData.annotation)
                    } else {
                        this.raiseError(["invalid value type", { found: "tagged union", expected: expected }], optionData.annotation)
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
        return objectData => {
            if (onInvalidType !== undefined && onInvalidType !== null) {
                onInvalidType(objectData.annotation)
            } else {
                this.raiseError(
                    ["invalid value type", { found: "object", expected: expected }],
                    objectData.annotation,
                )
            }
            return {
                property: propertyData => {
                    return p.value({
                        exists: this.createDummyOnProperty(propertyData.data.key, propertyData.annotation),
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
        return arrayData => {
            if (onInvalidType !== undefined && onInvalidType !== null) {
                onInvalidType(arrayData.annotation)
            } else {
                this.raiseError(
                    ["invalid value type", { found: "array", expected: expected }],
                    arrayData.annotation
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
        callback: (
            data: {
                data: StringData2
                annotation: TokenAnnotation
            },
        ) => p.IValue<boolean>,
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
            data: StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: (svData: {
            data: astn.StringData2
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
        callback: (value: boolean, data: {
            data: StringData2
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
            svData => {
                const onError = () => {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation)
                    } else {
                        this.raiseError(["invalid string", { expected: expectValue, found: createSerializedString(svData.data, "", "\\n") }], svData.annotation)
                    }
                    return p.value(false)
                }
                if (svData.data.type[0] !== "nonwrapped") {
                    return onError()
                }
                if (svData.data.type[1].value === "true") {
                    return callback(true, svData)
                }
                if (svData.data.type[1].value === "false") {
                    return callback(false, svData)
                }
                return onError()
            },
            onInvalidType,
        )
    }
    public expectNull(
        callback: ($: {
            data: StringData2
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
            svData => {
                const isNull = svData.data.type[0] === "nonwrapped"
                    && svData.data.type[1].value === "null"
                if (!isNull) {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation)
                    } else {
                        this.raiseError(["invalid string", { expected: expectValue, found: createSerializedString(svData.data, "", "\\n") }], svData.annotation)
                    }
                    return p.value(false)
                }
                return callback(svData)
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
        callback: (value: number, data: {
            data: StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: (svData: astn.StringData2) => p.IValue<boolean>,
    ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

        const expectValue: ExpectErrorValue = {
            "type": "number",
            "null allowed": onNull !== undefined,
        }
        return this.expectStringImp(
            expectValue,
            svData => {
                const onError = () => {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation)
                    } else {
                        this.raiseError(["not a valid number", { value: createSerializedString(svData.data, "", "\\n") }], svData.annotation)
                    }
                    return p.value(false)
                }
                if (svData.data.type[0] !== "nonwrapped") {
                    return onError()
                }
                //eslint-disable-next-line
                const nr = new Number(svData.data.type[1].value).valueOf()
                if (isNaN(nr)) {
                    return onError()
                }
                return callback(nr, svData)
            },
            onInvalidType
        )
    }
    public expectQuotedString(
        callback: (value: string, data: {
            data: StringData2
            annotation: TokenAnnotation
        }) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: (svData: astn.StringData2) => p.IValue<boolean>,
    ): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {

        const expectValue: ExpectErrorValue = {
            "type": "quoted string",
            "null allowed": onNull !== undefined,
        }
        return this.expectStringImp(
            expectValue,
            svData => {
                const onError = () => {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation)
                    } else {
                        this.raiseError(["not a quoted string", { }], svData.annotation)
                    }
                    return p.value(false)
                }
                if (svData.data.type[0] !== "quoted") {
                    return onError()
                }
                return callback(svData.data.type[1].value, svData)
            },
            onInvalidType
        )
    }
    public expectDictionary(
        onBegin: ($: {
            data: ObjectData
            annotation: TokenAnnotation
        }) => void,
        onProperty: (propertyData: {
            data: PropertyData
            annotation: TokenAnnotation
        }) => astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>,
        onEnd: (endData: {
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
        onNull?: (svData: {
            data: StringData2
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
        onEnd: (endData: {
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
        onEnd?: (endData: {
            annotation: TokenAnnotation
        }) => void,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: (svData: {
            data: StringData2
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
        onShorthandTypeEnd?: (endData: {
            annotation: TokenAnnotation
        }) => void,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: (svData: {
            data: StringData2
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
        onUnexpectedOption?: (
            $: {
                tuAnnotation: TokenAnnotation
                data: OptionData
                optionAnnotation: TokenAnnotation
            },
        ) => void,
        onMissingOption?: () => void,
        onInvalidType?: OnInvalidType<TokenAnnotation>,
        onNull?: (svData: {
            data: StringData2
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
