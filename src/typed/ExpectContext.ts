/* eslint
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as astn from ".."
import { ParserAnnotationData } from "../stackedParser/createStackedParser"
import { ArrayBeginData, ArrayEndData, ObjectBeginData, ObjectEndData, OptionData, PropertyData, SimpleValueData2, TaggedUnionData } from "../stackedParser/handlers"

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

export type ExpectErrorHandler = (issue: ExpectError, range: astn.Range) => void

export type ExpectedElement = {
    name: string
    getHandler: (() => astn.RequiredValueHandler<ParserAnnotationData>)
}

export type ExpectedElements = ExpectedElement[]

export type ExpectedProperty = {
    onExists: (range: astn.Range, contextData: astn.ParserAnnotationData) => astn.RequiredValueHandler<ParserAnnotationData>
    onNotExists: null | ((
        openRangeOfContainingType: astn.Range,
        openDataOfContainingType: astn.ObjectOpenData,
        closeRangeOfContainingType: astn.Range,
        closeDataOfContainingType: astn.ObjectCloseData
    ) => void
    ) //if onNotExists is null and the property does not exist, an error will be raised
}

export type ExpectedProperties = {
    [key: string]: ExpectedProperty
}


export type Options = {
    [key: string]: (
        taggedUnionData: TaggedUnionData<ParserAnnotationData>,
        optionData: OptionData<ParserAnnotationData>,
    ) => astn.RequiredValueHandler<ParserAnnotationData>
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

type OnInvalidType = null | ((range: astn.Range) => void)

export class ExpectContext {
    private readonly errorHandler: ExpectErrorHandler
    private readonly warningHandler: ExpectErrorHandler
    //private readonly createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler
    //private readonly createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler
    private readonly createDummyOnProperty: (range: astn.Range, key: string, contextData: astn.ParserAnnotationData) => astn.OnValue<ParserAnnotationData>
    private readonly createDummyValueHandler: () => astn.OnValue<ParserAnnotationData>
    private readonly createDummyRequiredValueHandler: () => astn.RequiredValueHandler<ParserAnnotationData>
    private readonly duplicateEntrySeverity: Severity
    private readonly onDuplicateEntry: OnDuplicateEntry
    constructor(
        errorHandler: ExpectErrorHandler,
        warningHandler: ExpectErrorHandler,
        //createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler,
        //createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler,
        createDummyPropertyHandler: (range: astn.Range, key: string, contextData: astn.ParserAnnotationData) => astn.OnValue<ParserAnnotationData>,
        createDummyValueHandler: () => astn.OnValue<ParserAnnotationData>,
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
    public raiseWarning(issue: ExpectError, range: astn.Range): void {
        this.warningHandler(issue, range)
    }
    public raiseError(issue: ExpectError, range: astn.Range): void {
        this.errorHandler(issue, range)
    }
    public createDictionaryHandler(
        onEntry: (propertyData: PropertyData<ParserAnnotationData>) => astn.RequiredValueHandler<ParserAnnotationData>,
        onBegin?: (range: astn.Range, metaData: astn.ObjectOpenData) => void,
        onEnd?: (endData: ObjectEndData<ParserAnnotationData>) => void,
    ): astn.OnObject<ParserAnnotationData> {
        return objectData => {
            if (onBegin) {
                onBegin(objectData.annotation.range, objectData.data)
            }
            if (objectData.data.openCharacter !== "{") {
                this.raiseWarning(["expected token", { token: "open curly", found: objectData.data.openCharacter }], objectData.annotation.range)
            }
            const foundEntries: string[] = []
            return {
                onData: propertyData => {
                    const process = (): astn.RequiredValueHandler<ParserAnnotationData> => {
                        if (foundEntries.includes(propertyData.key)) {
                            switch (this.duplicateEntrySeverity) {
                                case Severity.error:
                                    this.raiseError(["duplicate entry", { key: propertyData.key }], propertyData.annotation.range)
                                    break
                                case Severity.nothing:
                                    break
                                case Severity.warning:
                                    this.raiseWarning(["duplicate entry", { key: propertyData.key }], propertyData.annotation.range)
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
                    if (endData.data.closeCharacter !== "}") {
                        this.raiseWarning(["expected token", { token: "close curly", found: endData.data.closeCharacter }], endData.annotation.range)
                    }
                    if (onEnd) {
                        onEnd(endData)
                    }
                    return p.value(null)
                },
            }
        }
    }
    public createTypeHandler(
        expectedProperties: ExpectedProperties,
        onBegin?: (objectData: ObjectBeginData<ParserAnnotationData>) => void,
        onEnd?: (hasErrors: boolean, endRange: astn.Range, endData: astn.ObjectCloseData, contextData: astn.ParserAnnotationData) => void,
        onUnexpectedProperty?: (key: string, range: astn.Range, contextData: astn.ParserAnnotationData) => astn.RequiredValueHandler<ParserAnnotationData>,
    ): astn.OnObject<ParserAnnotationData> {
        return objectData => {
            if (onBegin) {
                onBegin(objectData)
            }
            if (objectData.data.openCharacter !== "(") {
                this.raiseWarning(["expected token", { token: "open paren", found: objectData.data.openCharacter }], objectData.annotation.range)
            }
            const foundProperies: string[] = []
            let hasErrors = false
            return {
                onData: propertyData => {
                    const onProperty = (): astn.RequiredValueHandler<ParserAnnotationData> => {
                        const expected = expectedProperties[propertyData.key]
                        if (expected === undefined) {
                            hasErrors = true
                            this.raiseError(["unexpected property", {
                                "found key": propertyData.key,
                                "valid keys": Object.keys(expectedProperties).sort(),
                            }], propertyData.annotation.range)
                            if (onUnexpectedProperty !== undefined) {
                                return onUnexpectedProperty(propertyData.key, propertyData.annotation.range, propertyData.annotation)
                            } else {
                                return {
                                    onExists: this.createDummyOnProperty(propertyData.annotation.range, propertyData.key, propertyData.annotation),
                                    onMissing: () => {
                                        //
                                    },
                                }
                            }
                        }
                        return expected.onExists(propertyData.annotation.range, propertyData.annotation)
                    }
                    const process = (): astn.RequiredValueHandler<ParserAnnotationData> => {
                        if (foundProperies.includes(propertyData.key)) {
                            switch (this.duplicateEntrySeverity) {
                                case Severity.error:
                                    this.raiseError(["duplicate property", { name: propertyData.key }], propertyData.annotation.range)
                                    break
                                case Severity.nothing:
                                    break
                                case Severity.warning:
                                    this.raiseWarning(["duplicate property", { name: propertyData.key }], propertyData.annotation.range)
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
                    if (endData.data.closeCharacter !== ")") {
                        this.raiseWarning(["expected token", { token: "close paren", found: endData.data.closeCharacter }], endData.annotation.range)
                    }
                    Object.keys(expectedProperties).forEach(epName => {
                        if (!foundProperies.includes(epName)) {
                            const ep = expectedProperties[epName]
                            if (ep.onNotExists === null) {
                                this.raiseError(["missing property", { name: epName }], objectData.annotation.range)//FIX print location properly
                                hasErrors = true
                            } else {
                                ep.onNotExists(
                                    objectData.annotation.range,
                                    objectData.data,
                                    endData.annotation.range,
                                    endData.data
                                )
                            }
                        }
                    })
                    if (onEnd) {
                        onEnd(hasErrors, endData.annotation.range, endData.data, endData.annotation)
                    }
                    return p.value(null)

                },
            }
        }
    }
    public createShorthandTypeHandler(
        expectedElements: ExpectedElements,
        onBegin?: (data: ArrayBeginData<ParserAnnotationData>) => void,
        onEnd?: (endData: ArrayEndData<ParserAnnotationData>) => void
    ): astn.OnArray<ParserAnnotationData> {
        return arrayData => {
            if (onBegin) {
                onBegin(arrayData)
            }
            if (arrayData.data.openCharacter !== "<") {
                this.raiseWarning(["expected token", { token: "open angle bracket", found: arrayData.data.openCharacter }], arrayData.annotation.range)
            }
            let index = 0
            return {
                onData: (range): astn.OnValue<ParserAnnotationData> => {
                    const ee = expectedElements[index]
                    index++
                    if (ee === undefined) {
                        this.raiseError(["superfluous element", {}], range)//FIX print range properly
                        return this.createDummyValueHandler()
                    } else {
                        return ee.getHandler().onExists
                    }
                },
                onEnd: endData => {
                    if (endData.data.closeCharacter !== ">") {
                        this.raiseWarning(["expected token", { token: "close angle bracket", found: endData.data.closeCharacter }], endData.annotation.range)
                    }
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(['elements missing', {
                            names: expectedElements.map(ee => {
                                return ee.name
                            }),
                        }], endData.annotation.range)
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
        onElement: () => astn.OnValue<ParserAnnotationData>,
        onBegin?: (beginData: ArrayBeginData<ParserAnnotationData>) => void,
        onEnd?: (endData: ArrayEndData<ParserAnnotationData>) => void,
    ): astn.OnArray<ParserAnnotationData> {
        return arrayData => {
            if (onBegin) {
                onBegin(arrayData)
            }
            if (arrayData.data.openCharacter !== "[") {
                this.raiseWarning(["expected token", { token: "open bracket", found: arrayData.data.openCharacter }], arrayData.annotation.range)
            }
            return {
                onData: (): astn.OnValue<ParserAnnotationData> => onElement(),
                onEnd: endData => {
                    if (endData.data.closeCharacter !== "]") {
                        this.raiseWarning(["expected token", { token: "close bracket", found: endData.data.closeCharacter }], endData.annotation.range)
                    }
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
    //                                 return this.raiseError(`unknown option: '${value}'`, metaData.annotation.range)
    //                             }
    //                             dataHandler = optionHandler(
    //                                 {
    //                                     start: beginMetaData.start,
    //                                     optionRange: metaData.annotation.range,
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
        options: Options,
        onUnexpectedOption?: (
            taggedUnionData: TaggedUnionData<ParserAnnotationData>,
            optionData: OptionData<ParserAnnotationData>
        ) => void,
        onMissingOption?: () => void,
    ): astn.OnTaggedUnion<ParserAnnotationData> {
        return tuData => {
            return {
                option: optionData => {

                    const optionHandler = options[optionData.option]
                    if (optionHandler === undefined) {
                        this.raiseError(["unknown option", { "found": optionData.option, "valid options": Object.keys(options) }], optionData.annotation.range)
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
        onInvalidType?: OnInvalidType,
        onNull?: (range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
    ): astn.OnSimpleValue<ParserAnnotationData> {
        return svData => {
            if (onNull !== undefined && svData.data.value === "null" && svData.data.quote === null) {
                onNull(svData.annotation.range, svData.data)
            } else {
                if (onInvalidType !== undefined && onInvalidType !== null) {
                    onInvalidType(svData.annotation.range)
                } else {
                    this.raiseError(["invalid value type", {
                        found: "simple value",
                        expected: expected,

                    }], svData.annotation.range)
                }
            }
            return p.value(false)
        }
    }
    public createNullHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType,
    ): astn.OnSimpleValue<ParserAnnotationData> {
        return svData => {
            if (onInvalidType !== undefined && onInvalidType !== null) {
                onInvalidType(svData.annotation.range)
            } else {
                this.raiseError(["invalid value type", { found: "simple value", expected: expected }], svData.annotation.range)
            }
            return p.value(false)
        }
    }
    public createUnexpectedTaggedUnionHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType,
    ): astn.OnTaggedUnion<ParserAnnotationData> {
        return (): astn.TaggedUnionHandler<ParserAnnotationData> => {
            return {
                option: optionData => {
                    if (onInvalidType !== undefined && onInvalidType !== null) {
                        onInvalidType(optionData.annotation.range)
                    } else {
                        this.raiseError(["invalid value type", { found: "tagged union", expected: expected }], optionData.annotation.range)
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
        onInvalidType?: OnInvalidType,
    ): astn.OnObject<ParserAnnotationData> {
        return objectData => {
            return {
                onData: propertyData => {
                    return p.value({
                        onExists: this.createDummyOnProperty(propertyData.annotation.range, propertyData.key, propertyData.annotation),
                        onMissing: (): void => {
                            //
                        },
                    })
                },
                onEnd: endData => {
                    if (onInvalidType !== undefined && onInvalidType !== null) {
                        onInvalidType(endData.annotation.range)
                    } else {
                        this.raiseError(
                            ["invalid value type", { found: "object", expected: expected }],
                            astn.createRangeFromLocations(objectData.annotation.range.start, astn.getEndLocationFromRange(endData.annotation.range))
                        )
                    }
                    return p.value(null)
                },
            }
        }
    }
    public createUnexpectedArrayHandler(
        expected: ExpectErrorValue,
        onInvalidType?: OnInvalidType,
    ): astn.OnArray<ParserAnnotationData> {
        return arrayData => {
            return {
                onData: (): astn.OnValue<ParserAnnotationData> => {
                    return this.createDummyValueHandler()
                },
                onEnd: endData => {
                    if (onInvalidType !== undefined && onInvalidType !== null) {
                        onInvalidType(endData.annotation.range)
                    } else {
                        this.raiseError(
                            ["invalid value type", { found: "array", expected: expected }],
                            astn.createRangeFromLocations(arrayData.annotation.range.start, astn.getEndLocationFromRange(endData.annotation.range))
                        )
                    }
                    return p.value(null)

                },
            }
        }
    }
    public expectNothing(
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler<ParserAnnotationData> {
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
            data: SimpleValueData2<ParserAnnotationData>,
        ) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler<ParserAnnotationData> {
        return {
            array: this.createUnexpectedArrayHandler(expected, onInvalidType),
            object: this.createUnexpectedObjectHandler(expected, onInvalidType),
            simpleValue: callback,
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expected, onInvalidType),
        }
    }
    public expectSimpleValue(
        callback: (data: SimpleValueData2<ParserAnnotationData>) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
        onNull?: (range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
    ): astn.ValueHandler<ParserAnnotationData> {

        const expectValue: ExpectErrorValue = {
            "type": "simple value",
            "null allowed": onNull !== undefined,
        }
        return this.expectSimpleValueImp(expectValue, callback, onInvalidType)
    }
    public expectBoolean(
        callback: (value: boolean, data: SimpleValueData2<ParserAnnotationData>) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler<ParserAnnotationData> {
        const expectValue: ExpectErrorValue = {
            "type": "boolean",
            "null allowed": false,
        }
        return this.expectSimpleValueImp(
            expectValue,
            svData => {
                if (svData.data.quote !== null) {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation.range)
                    } else {
                        this.raiseError(["invalid simple value", { expected: expectValue, found: svData.data.value }], svData.annotation.range)
                    }
                    return p.value(false)
                }
                switch (svData.data.value) {
                    case "true": {
                        return callback(true, svData)
                    }
                    case "false": {
                        return callback(false, svData)
                    }
                    default:

                        if (onInvalidType) {
                            onInvalidType(svData.annotation.range)
                        } else {
                            this.raiseError(["invalid simple value", { expected: expectValue, found: svData.data.value }], svData.annotation.range)
                        }
                        return p.value(false)
                }
            },
            onInvalidType,
        )
    }
    public expectNull(
        callback: (data: SimpleValueData2<ParserAnnotationData>) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler<ParserAnnotationData> {

        const expectValue: ExpectErrorValue = {
            "type": "null",
            "null allowed": false,
        }
        return this.expectSimpleValueImp(
            expectValue,
            svData => {
                if (svData.data.quote !== null) {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation.range)
                    } else {
                        this.raiseError(["invalid simple value", { expected: expectValue, found: svData.data.value }], svData.annotation.range)
                    }
                    return p.value(false)
                }
                if (svData.data.value === "null") {
                    return callback(svData)
                } else {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation.range)
                    } else {
                        this.raiseError(["invalid simple value", { expected: expectValue, found: svData.data.value }], svData.annotation.range)
                    }
                    return p.value(false)
                }
            },
            onInvalidType
        )
    }
    public expectValue(
        onValue: astn.OnValue<ParserAnnotationData>,
        onMissing?: () => void,
    ): astn.RequiredValueHandler<ParserAnnotationData> {
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
        callback: (value: number, data: SimpleValueData2<ParserAnnotationData>) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
        onNull?: (range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
    ): astn.ValueHandler<ParserAnnotationData> {

        const expectValue: ExpectErrorValue = {
            "type": "number",
            "null allowed": onNull !== undefined,
        }
        return this.expectSimpleValueImp(
            expectValue,
            svData => {
                //eslint-disable-next-line
                const nr = new Number(svData.data.value).valueOf()
                if (isNaN(nr)) {
                    if (onInvalidType) {
                        onInvalidType(svData.annotation.range)
                    } else {
                        this.raiseError(["not a valid number", { value: svData.data.value }], svData.annotation.range)
                    }
                }
                return callback(nr, svData)
            },
            onInvalidType
        )
    }
    public expectDictionary(
        onBegin: (range: astn.Range, metaData: astn.ObjectOpenData) => void,
        onProperty: (propertyData: PropertyData<ParserAnnotationData>) => astn.RequiredValueHandler<ParserAnnotationData>,
        onEnd: (endData: ObjectEndData<ParserAnnotationData>) => void,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler<ParserAnnotationData> {

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
        expectedProperties: ExpectedProperties = {},
        onBegin?: (data: ObjectBeginData<ParserAnnotationData>) => void,
        onEnd?: (hasErrors: boolean, range: astn.Range, endData: astn.ObjectCloseData, contextData: astn.ParserAnnotationData) => void,
        onUnexpectedProperty?: (key: string, range: astn.Range, contextData: astn.ParserAnnotationData) => astn.RequiredValueHandler<ParserAnnotationData>,
        onInvalidType?: OnInvalidType,
        onNull?: (range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
    ): astn.ValueHandler<ParserAnnotationData> {

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
        onBegin: (data: ArrayBeginData<ParserAnnotationData>) => void,
        onElement: () => astn.OnValue<ParserAnnotationData>,
        onEnd: (endData: ArrayEndData<ParserAnnotationData>) => void,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler<ParserAnnotationData> {

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
        expectedElements: ExpectedElements,
        onBegin?: (data: ArrayBeginData<ParserAnnotationData>) => void,
        onEnd?: (endData: ArrayEndData<ParserAnnotationData>) => void,
        onInvalidType?: OnInvalidType,
        onNull?: (range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
    ): astn.ValueHandler<ParserAnnotationData> {

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
        expectedProperties: ExpectedProperties = {},
        expectedElements: ExpectedElements,
        onTypeBegin?: (data: ObjectBeginData<ParserAnnotationData>) => void,
        onTypeEnd?: (hasErrors: boolean, range: astn.Range, endData: astn.ObjectCloseData, contextData: astn.ParserAnnotationData) => void,
        onUnexpectedProperty?: (key: string, range: astn.Range, contextData: astn.ParserAnnotationData) => astn.RequiredValueHandler<ParserAnnotationData>,
        onShorthandTypeBegin?: (data: ArrayBeginData<ParserAnnotationData>) => void,
        onShorthandTypeEnd?: (endData: ArrayEndData<ParserAnnotationData>) => void,
        onInvalidType?: OnInvalidType,
        onNull?: (range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
    ): astn.ValueHandler<ParserAnnotationData> {

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
        options: Options,
        onUnexpectedOption?: (
            tuData: TaggedUnionData<ParserAnnotationData>,
            optionData: OptionData<ParserAnnotationData>,
        ) => void,
        onMissingOption?: () => void,
        onInvalidType?: OnInvalidType,
        onNull?: (range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
    ): astn.ValueHandler<ParserAnnotationData> {

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
