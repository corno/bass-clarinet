/* eslint
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as astn from ".."
import { ArrayBeginData, ArrayEndData, ObjectBeginData, ObjectEndData, OptionData, PropertyData, SimpleValueData2, TaggedUnionData } from "../handlers"

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
    | ["invalid simple value", {
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
    | "simple value"
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
        case "simple value": {
            return `a simple value (a number, a string, a keyword, a boolean)`
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
        case "invalid simple value": {
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
            return `'${$.value} is not a valid number`
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

export type ExpectErrorHandler<Annotation> = (issue: ExpectError, annotation: Annotation) => void

export type ExpectedElement<Annotation> = {
    name: string
    getHandler: (() => astn.RequiredValueHandler<Annotation>)
}

export type ExpectedElements<Annotation> = ExpectedElement<Annotation>[]

export type ExpectedProperty<Annotation> = {
    onExists: (data: astn.PropertyData<Annotation>) => astn.RequiredValueHandler<Annotation>
    onNotExists: null | ((
        beginData: ObjectBeginData<Annotation>,
        endData: ObjectEndData<Annotation>,
    ) => void
    ) //if onNotExists is null and the property does not exist, an error will be raised
}

export type ExpectedProperties<Annotation> = {
    [key: string]: ExpectedProperty<Annotation>
}


export type Options<Annotation> = {
    [key: string]: (
        taggedUnionData: TaggedUnionData<Annotation>,
        optionData: OptionData<Annotation>,
    ) => astn.RequiredValueHandler<Annotation>
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

type OnInvalidType<Annotation> = null | ((annotation: Annotation) => void)

export class ExpectContext<Annotation> {
    private readonly errorHandler: ExpectErrorHandler<Annotation>
    private readonly warningHandler: ExpectErrorHandler<Annotation>
    //private readonly createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler
    //private readonly createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler
    private readonly createDummyOnProperty: (key: string, annotation: Annotation) => astn.ValueHandler<Annotation>
    private readonly createDummyValueHandler: () => astn.ValueHandler<Annotation>
    private readonly createDummyRequiredValueHandler: () => astn.RequiredValueHandler<Annotation>
    private readonly duplicateEntrySeverity: Severity
    private readonly onDuplicateEntry: OnDuplicateEntry
    constructor(
        errorHandler: ExpectErrorHandler<Annotation>,
        warningHandler: ExpectErrorHandler<Annotation>,
        //createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler,
        //createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler,
        createDummyPropertyHandler: (key: string, annotation: Annotation) => astn.ValueHandler<Annotation>,
        createDummyValueHandler: () => astn.ValueHandler<Annotation>,
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
                onExists: this.createDummyValueHandler(),
                onMissing: () => {
                    //
                },
            }
        }
    }
    public raiseWarning(issue: ExpectError, annotation: Annotation): void {
        this.warningHandler(issue, annotation)
    }
    public raiseError(issue: ExpectError, annotation: Annotation): void {
        this.errorHandler(issue, annotation)
    }
    public createDictionaryHandler(
        onEntry: (propertyData: PropertyData<Annotation>) => astn.RequiredValueHandler<Annotation>,
        onBegin?: (data: ObjectBeginData<Annotation>) => void,
        onEnd?: (endData: ObjectEndData<Annotation>) => void,
    ): astn.OnObject<Annotation> {
        return data => {

            if (data.type[0] !== "dictionary") {
                this.raiseWarning(["object is not a dictionary", {}], data.annotation)
            }
            if (onBegin) {
                onBegin(data)
            }
            const foundEntries: string[] = []
            return {
                onData: propertyData => {
                    const process = (): astn.RequiredValueHandler<Annotation> => {
                        if (foundEntries.includes(propertyData.key)) {
                            switch (this.duplicateEntrySeverity) {
                                case Severity.error:
                                    this.raiseError(["duplicate entry", { key: propertyData.key }], propertyData.annotation)
                                    break
                                case Severity.nothing:
                                    break
                                case Severity.warning:
                                    this.raiseWarning(["duplicate entry", { key: propertyData.key }], propertyData.annotation)
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
                    foundEntries.push(propertyData.key)
                    return p.value(vh)
                },
                onEnd: endData => {
                    if (onEnd) {
                        onEnd(endData)
                    }
                    return p.value(null)
                },
            }
        }
    }
    public createTypeHandler(
        expectedProperties: ExpectedProperties<Annotation>,
        onBegin?: (objectData: ObjectBeginData<Annotation>) => void,
        onEnd?: (hasErrors: boolean, endData: ObjectEndData<Annotation>) => void,
        onUnexpectedProperty?: (data: astn.PropertyData<Annotation>) => astn.RequiredValueHandler<Annotation>,
    ): astn.OnObject<Annotation> {
        return data => {

            if (data.type[0] !== "verbose type") {
                this.raiseWarning(["object is not a verbose type", {}], data.annotation)
            }
            if (onBegin) {
                onBegin(data)
            }
            const foundProperies: string[] = []
            let hasErrors = false
            return {
                onData: propertyData => {
                    const onProperty = (): astn.RequiredValueHandler<Annotation> => {
                        const expected = expectedProperties[propertyData.key]
                        if (expected === undefined) {
                            hasErrors = true
                            this.raiseError(["unexpected property", {
                                "found key": propertyData.key,
                                "valid keys": Object.keys(expectedProperties).sort(),
                            }], propertyData.annotation)
                            if (onUnexpectedProperty !== undefined) {
                                return onUnexpectedProperty(propertyData)
                            } else {
                                return {
                                    onExists: this.createDummyOnProperty(propertyData.key, propertyData.annotation),
                                    onMissing: () => {
                                        //
                                    },
                                }
                            }
                        }
                        return expected.onExists(propertyData)
                    }
                    const process = (): astn.RequiredValueHandler<Annotation> => {
                        if (foundProperies.includes(propertyData.key)) {
                            switch (this.duplicateEntrySeverity) {
                                case Severity.error:
                                    this.raiseError(["duplicate property", { name: propertyData.key }], propertyData.annotation)
                                    break
                                case Severity.nothing:
                                    break
                                case Severity.warning:
                                    this.raiseWarning(["duplicate property", { name: propertyData.key }], propertyData.annotation)
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
                    foundProperies.push(propertyData.key)
                    return p.value(vh)
                },
                onEnd: endData => {
                    Object.keys(expectedProperties).forEach(epName => {
                        if (!foundProperies.includes(epName)) {
                            const ep = expectedProperties[epName]
                            if (ep.onNotExists === null) {
                                this.raiseError(["missing property", { name: epName }], data.annotation)//FIX print location properly
                                hasErrors = true
                            } else {
                                ep.onNotExists(
                                    data,
                                    endData,
                                )
                            }
                        }
                    })
                    if (onEnd) {
                        onEnd(hasErrors, endData)
                    }
                    return p.value(null)

                },
            }
        }
    }
    public createShorthandTypeHandler(
        expectedElements: ExpectedElements<Annotation>,
        onBegin?: (data: ArrayBeginData<Annotation>) => void,
        onEnd?: (endData: ArrayEndData<Annotation>) => void
    ): astn.OnArray<Annotation> {
        return typeData => {
            if (onBegin) {
                onBegin(typeData)
            }
            if (typeData.type[0] !== "shorthand type") {
                this.raiseWarning(["array is not a shorthand type", {}], typeData.annotation)
            }
            let index = 0
            return {
                onData: () => {
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
                            simpleValue: data => {
                                this.raiseError(["superfluous element", {}], data.annotation)
                                return dvh.simpleValue(data)
                            },
                            taggedUnion: data => {
                                this.raiseError(["superfluous element", {}], data.annotation)
                                return dvh.taggedUnion(data)
                            },
                        }
                    } else {
                        return ee.getHandler().onExists
                    }
                },
                onEnd: endData => {
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(['elements missing', {
                            names: expectedElements.map(ee => {
                                return ee.name
                            }),
                        }], endData.annotation)
                        for (let i = index; i !== expectedElements.length; i += 1) {
                            const ee = expectedElements[i]
                            ee.getHandler().onMissing()
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
        onElement: () => astn.ValueHandler<Annotation>,
        onBegin?: (beginData: ArrayBeginData<Annotation>) => void,
        onEnd?: (endData: ArrayEndData<Annotation>) => void,
    ): astn.OnArray<Annotation> {
        return data => {
            if (data.type[0] !== "list") {
                this.raiseWarning(["array is not a list", {}], data.annotation)
            }
            if (onBegin) {
                onBegin(data)
            }
            return {
                onData: (): astn.ValueHandler<Annotation> => onElement(),
                onEnd: endData => {
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
    //                     // unquotedToken: (value, metaData) => {
    //                     //     if (dataHandler === null) {
    //                     //         return this.raiseError(`expected string`, dataRange)
    //                     //     } else {
    //                     //         dataHandler.unquotedToken(value, dataRange, dataComments, pauser)
    //                     //     }
    //                     // },
    //                     simpleValue: (value, metaData, optionComments) => {
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
    //                             dataHandler.simpleValue(value, metaData, optionComments)
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
        options: Options<Annotation>,
        onUnexpectedOption?: (
            taggedUnionData: TaggedUnionData<Annotation>,
            optionData: OptionData<Annotation>
        ) => void,
        onMissingOption?: () => void,
    ): astn.OnTaggedUnion<Annotation> {
        return tuData => {
            return {
                option: optionData => {

                    const optionHandler = options[optionData.option]
                    if (optionHandler === undefined) {
                        this.raiseError(["unknown option", { "found": optionData.option, "valid options": Object.keys(options) }], optionData.annotation)
                        if (onUnexpectedOption !== undefined) {
                            onUnexpectedOption(
                                tuData,
                                optionData,
                            )
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
    public createUnexpectedSimpleValueHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<Annotation>,
        onNull?: (svData: SimpleValueData2<Annotation>) => p.IValue<boolean>,
    ): astn.OnSimpleValue<Annotation> {
        return svData => {
            if (onNull !== undefined && svData.value === "null" && svData.wrapper[0] === "none") {
                onNull(svData)
            } else {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType(svData.annotation)
                } else {
                    this.raiseError(["invalid value type", {
                        found: "simple value",
                        expected: expected,

                    }], svData.annotation)
                }
            }
            return p.value(false)
        }
    }
    public createNullHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.OnSimpleValue<Annotation> {
        return svData => {
            if (onInvalidType !== undefined && onInvalidType !== null) {
                onInvalidType(svData.annotation)
            } else {
                this.raiseError(["invalid value type", { found: "simple value", expected: expected }], svData.annotation)
            }
            return p.value(false)
        }
    }
    public createUnexpectedTaggedUnionHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.OnTaggedUnion<Annotation> {
        return (): astn.TaggedUnionHandler<Annotation> => {
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
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.OnObject<Annotation> {
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
                onData: propertyData => {
                    return p.value({
                        onExists: this.createDummyOnProperty(propertyData.key, propertyData.annotation),
                        onMissing: (): void => {
                            //
                        },
                    })
                },
                onEnd: _endData => {
                    return p.value(null)
                },
            }
        }
    }
    public createUnexpectedArrayHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.OnArray<Annotation> {
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
                onData: (): astn.ValueHandler<Annotation> => {
                    return this.createDummyValueHandler()
                },
                onEnd: _endData => {
                    return p.value(null)

                },
            }
        }
    }
    public expectNothing(
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.ValueHandler<Annotation> {
        const expectValue: ExpectErrorValue = {
            "type": "nothing",
            "null allowed": false,
        }
        return {
            array: this.createUnexpectedArrayHandler(expectValue, onInvalidType),
            object: this.createUnexpectedObjectHandler(expectValue, onInvalidType),
            simpleValue: this.createUnexpectedSimpleValueHandler(expectValue, onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
        }
    }
    public expectSimpleValueImp(
        expected: ExpectErrorValue,
        callback: (
            data: SimpleValueData2<Annotation>,
        ) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.ValueHandler<Annotation> {
        return {
            array: this.createUnexpectedArrayHandler(expected, onInvalidType),
            object: this.createUnexpectedObjectHandler(expected, onInvalidType),
            simpleValue: callback,
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expected, onInvalidType),
        }
    }
    public expectSimpleValue(
        callback: (data: SimpleValueData2<Annotation>) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<Annotation>,
        onNull?: (svData: astn.SimpleValueData2<Annotation>) => p.IValue<boolean>,
    ): astn.ValueHandler<Annotation> {

        const expectValue: ExpectErrorValue = {
            "type": "simple value",
            "null allowed": onNull !== undefined,
        }
        return this.expectSimpleValueImp(expectValue, callback, onInvalidType)
    }
    public expectBoolean(
        callback: (value: boolean, data: SimpleValueData2<Annotation>) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.ValueHandler<Annotation> {
        const expectValue: ExpectErrorValue = {
            "type": "boolean",
            "null allowed": false,
        }
        return this.expectSimpleValueImp(
            expectValue,
            svData => {
                if (svData.wrapper[0] !== "none") {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation)
                    } else {
                        this.raiseError(["invalid simple value", { expected: expectValue, found: svData.value }], svData.annotation)
                    }
                    return p.value(false)
                }
                switch (svData.value) {
                    case "true": {
                        return callback(true, svData)
                    }
                    case "false": {
                        return callback(false, svData)
                    }
                    default:

                        if (onInvalidType) {
                            onInvalidType(svData.annotation)
                        } else {
                            this.raiseError(["invalid simple value", { expected: expectValue, found: svData.value }], svData.annotation)
                        }
                        return p.value(false)
                }
            },
            onInvalidType,
        )
    }
    public expectNull(
        callback: (data: SimpleValueData2<Annotation>) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.ValueHandler<Annotation> {

        const expectValue: ExpectErrorValue = {
            "type": "null",
            "null allowed": false,
        }
        return this.expectSimpleValueImp(
            expectValue,
            svData => {
                if (svData.wrapper[0] !== "none") {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation)
                    } else {
                        this.raiseError(["invalid simple value", { expected: expectValue, found: svData.value }], svData.annotation)
                    }
                    return p.value(false)
                }
                if (svData.value === "null") {
                    return callback(svData)
                } else {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation)
                    } else {
                        this.raiseError(["invalid simple value", { expected: expectValue, found: svData.value }], svData.annotation)
                    }
                    return p.value(false)
                }
            },
            onInvalidType
        )
    }
    public expectValue(
        onValue: astn.ValueHandler<Annotation>,
        onMissing?: () => void,
    ): astn.RequiredValueHandler<Annotation> {
        return {
            onExists: onValue,
            onMissing: onMissing
                ? onMissing
                : (): void => {
                    //
                },
        }
    }
    public expectNumber(
        callback: (value: number, data: SimpleValueData2<Annotation>) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType<Annotation>,
        onNull?: (svData: astn.SimpleValueData) => p.IValue<boolean>,
    ): astn.ValueHandler<Annotation> {

        const expectValue: ExpectErrorValue = {
            "type": "number",
            "null allowed": onNull !== undefined,
        }
        return this.expectSimpleValueImp(
            expectValue,
            svData => {
                //eslint-disable-next-line
                const nr = new Number(svData.value).valueOf()
                if (isNaN(nr)) {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation)
                    } else {
                        this.raiseError(["not a valid number", { value: svData.value }], svData.annotation)
                    }
                }
                return callback(nr, svData)
            },
            onInvalidType
        )
    }
    public expectDictionary(
        onBegin: (data: ObjectBeginData<Annotation>) => void,
        onProperty: (propertyData: PropertyData<Annotation>) => astn.RequiredValueHandler<Annotation>,
        onEnd: (endData: ObjectEndData<Annotation>) => void,
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.ValueHandler<Annotation> {

        const expectValue: ExpectErrorValue = {
            "type": "dictionary",
            "null allowed": false,
        }
        return {
            array: this.createUnexpectedArrayHandler(expectValue, onInvalidType),
            object: this.createDictionaryHandler(onProperty, onBegin, onEnd),
            simpleValue: this.createUnexpectedSimpleValueHandler(expectValue, onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
        }
    }
    public expectType(
        expectedProperties: ExpectedProperties<Annotation> = {},
        onBegin?: (data: ObjectBeginData<Annotation>) => void,
        onEnd?: (hasErrors: boolean, data: ObjectEndData<Annotation>) => void,
        onUnexpectedProperty?: (data: astn.PropertyData<Annotation>) => astn.RequiredValueHandler<Annotation>,
        onInvalidType?: OnInvalidType<Annotation>,
        onNull?: (svData: SimpleValueData2<Annotation>) => p.IValue<boolean>,
    ): astn.ValueHandler<Annotation> {

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
            simpleValue: this.createUnexpectedSimpleValueHandler(expectValue, onInvalidType, onNull),
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
        }
    }
    public expectList(
        onBegin: (data: ArrayBeginData<Annotation>) => void,
        onElement: () => astn.ValueHandler<Annotation>,
        onEnd: (endData: ArrayEndData<Annotation>) => void,
        onInvalidType?: OnInvalidType<Annotation>,
    ): astn.ValueHandler<Annotation> {

        const expectValue: ExpectErrorValue = {
            "type": "list",
            "null allowed": false,
        }
        return {
            array: this.createListHandler(onElement, onBegin, onEnd),
            object: this.createUnexpectedObjectHandler(expectValue, onInvalidType),
            simpleValue: this.createUnexpectedSimpleValueHandler(expectValue, onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
        }
    }
    public expectShorthandType(
        expectedElements: ExpectedElements<Annotation>,
        onBegin?: (data: ArrayBeginData<Annotation>) => void,
        onEnd?: (endData: ArrayEndData<Annotation>) => void,
        onInvalidType?: OnInvalidType<Annotation>,
        onNull?: (svData: SimpleValueData2<Annotation>) => p.IValue<boolean>,
    ): astn.ValueHandler<Annotation> {

        const expectValue: ExpectErrorValue = {
            "type": "shorthand type",
            "null allowed": onNull !== undefined,
        }
        return {
            array: this.createShorthandTypeHandler(expectedElements, onBegin, onEnd),
            object: this.createUnexpectedObjectHandler(expectValue, onInvalidType),
            simpleValue: this.createUnexpectedSimpleValueHandler(expectValue, onInvalidType, onNull),
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
        }
    }

    public expectTypeOrShorthandType(
        expectedProperties: ExpectedProperties<Annotation> = {},
        expectedElements: ExpectedElements<Annotation>,
        onTypeBegin?: (data: ObjectBeginData<Annotation>) => void,
        onTypeEnd?: (hasErrors: boolean, data: ObjectEndData<Annotation>) => void,
        onUnexpectedProperty?: (data: astn.PropertyData<Annotation>) => astn.RequiredValueHandler<Annotation>,
        onShorthandTypeBegin?: (data: ArrayBeginData<Annotation>) => void,
        onShorthandTypeEnd?: (endData: ArrayEndData<Annotation>) => void,
        onInvalidType?: OnInvalidType<Annotation>,
        onNull?: (svData: SimpleValueData2<Annotation>) => p.IValue<boolean>,
    ): astn.ValueHandler<Annotation> {

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
            simpleValue: this.createUnexpectedSimpleValueHandler(expectValue, onInvalidType, onNull),
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expectValue, onInvalidType),
        }
    }
    public expectTaggedUnion(
        options: Options<Annotation>,
        onUnexpectedOption?: (
            tuData: TaggedUnionData<Annotation>,
            optionData: OptionData<Annotation>,
        ) => void,
        onMissingOption?: () => void,
        onInvalidType?: OnInvalidType<Annotation>,
        onNull?: (svData: SimpleValueData2<Annotation>) => p.IValue<boolean>,
    ): astn.ValueHandler<Annotation> {

        const expectValue: ExpectErrorValue = {
            "type": "tagged union",
            "null allowed": onNull !== undefined,
        }
        return {
            array: this.createUnexpectedArrayHandler(expectValue, onInvalidType),
            object: this.createUnexpectedObjectHandler(expectValue, onInvalidType),
            simpleValue: this.createUnexpectedSimpleValueHandler(expectValue, onInvalidType, onNull),
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
    //         simpleValue: this.createUnexpectedSimpleValueHandler("tagged union"),
    //         taggedUnion: this.createTaggedUnionHandler(options),
    //     }
    // }
}
