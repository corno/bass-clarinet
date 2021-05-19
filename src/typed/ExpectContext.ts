/* eslint
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as astn from ".."

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
        expected: ExpectErrorValueType
    }]
    | ["invalid simple value", {
        found: string
        expected: ExpectErrorValueType
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
        name: string
    }]
    | ["not a valid number", {
        value: string
    }]
    | ["too many elements", {
        expected: number
    }]
    | ["elements missing", {
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
    | "array type"
    | "tagged union"
    | "simple value"
    | "type"

export function printExpectErrorValueType(vt: ExpectErrorValueType): string {
    switch (vt) {
        case "array": {
            return `an array ([] or <>)`
        }
        case "array type": {
            return `an array type (<>)`
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
        default:
            return assertUnreachable(vt[0])
    }
}

export function printExpectError(issue: ExpectError): string {
    switch (issue[0]) {
        case "invalid value type": {
            const $ = issue[1]
            return `expected ${printExpectErrorValueType($.expected)} but found ${printExpectErrorValueType($.found)}`
        }
        case "invalid simple value": {
            const $ = issue[1]
            return `expected '${printExpectErrorValueType($.expected)}' but found '${$.found}'`
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
            return `unexpected property: '${$.name}'`
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
        case "too many elements": {
            const $ = issue[1]
            return `found more than the expected ${$.expected} element(s)`
        }
        case "elements missing": {
            //const $ = issue[1]
            return `elements missing`
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

export type ExpectedElements = (() => astn.RequiredValueHandler)[]

export type ExpectedProperty = {
    onExists: (range: astn.Range, contextData: astn.ContextData) => astn.RequiredValueHandler
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
        taggedUnionRange: astn.Range,
        optionRange: astn.Range,
        optionContextData: astn.ContextData,
    ) => astn.RequiredValueHandler
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

type OnInvalidType = (range: astn.Range) => void

export class ExpectContext {
    private readonly errorHandler: ExpectErrorHandler
    private readonly warningHandler: ExpectErrorHandler
    //private readonly createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler
    //private readonly createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler
    private readonly createDummyOnProperty: (range: astn.Range, key: string, contextData: astn.ContextData) => astn.OnValue
    private readonly createDummyValueHandler: () => astn.OnValue
    private readonly createDummyRequiredValueHandler: () => astn.RequiredValueHandler
    private readonly duplicateEntrySeverity: Severity
    private readonly onDuplicateEntry: OnDuplicateEntry
    constructor(
        errorHandler: ExpectErrorHandler,
        warningHandler: ExpectErrorHandler,
        //createDummyArrayHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ArrayHandler,
        //createDummyObjectHandler: (range: bc.Range, data: bc.ArrayOpenData, contextData: bc.ContextData) => bc.ObjectHandler,
        createDummyPropertyHandler: (range: astn.Range, key: string, contextData: astn.ContextData) => astn.OnValue,
        createDummyValueHandler: () => astn.OnValue,
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
                onValue: this.createDummyValueHandler(),
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
        onEntry: (key: string, range: astn.Range, contextData: astn.ContextData) => astn.RequiredValueHandler,
        onBegin?: (range: astn.Range, metaData: astn.ObjectOpenData) => void,
        onEnd?: (range: astn.Range, metaData: astn.ObjectCloseData, contextData: astn.ContextData) => void,
    ): astn.OnObject {
        return (beginRange: astn.Range, beginMetaData: astn.ObjectOpenData): astn.ObjectHandler => {
            if (onBegin) {
                onBegin(beginRange, beginMetaData)
            }
            if (beginMetaData.openCharacter !== "{") {
                this.raiseWarning(["expected token", { token: "open curly", found: beginMetaData.openCharacter }], beginRange)
            }
            const foundEntries: string[] = []
            return {
                property: (range: astn.Range, key: string, propertyContextData: astn.ContextData): p.IValue<astn.RequiredValueHandler> => {
                    const process = (): astn.RequiredValueHandler => {
                        if (foundEntries.includes(key)) {
                            switch (this.duplicateEntrySeverity) {
                                case Severity.error:
                                    this.raiseError(["duplicate entry", { key: key }], range)
                                    break
                                case Severity.nothing:
                                    break
                                case Severity.warning:
                                    this.raiseWarning(["duplicate entry", { key: key }], range)
                                    break
                                default:
                                    assertUnreachable(this.duplicateEntrySeverity)
                            }
                            switch (this.onDuplicateEntry) {
                                case OnDuplicateEntry.ignore:
                                    return this.createDummyRequiredValueHandler()
                                case OnDuplicateEntry.overwrite:
                                    return onEntry(key, range, propertyContextData)
                                default:
                                    return assertUnreachable(this.onDuplicateEntry)
                            }
                        } else {
                            return onEntry(key, range, propertyContextData)
                        }

                    }
                    const vh = process()
                    foundEntries.push(key)
                    return p.value(vh)
                },
                end: (endRange: astn.Range, endMetaData: astn.ObjectCloseData, endContextData: astn.ContextData): void => {
                    if (endMetaData.closeCharacter !== "}") {
                        this.raiseWarning(["expected token", { token: "close curly", found: endMetaData.closeCharacter }], endRange)
                    }
                    if (onEnd) {
                        onEnd(endRange, endMetaData, endContextData)
                    }
                },
            }
        }
    }
    public createTypeHandler(
        expectedProperties: ExpectedProperties,
        onBegin?: (beginRange: astn.Range, beginData: astn.ObjectOpenData) => void,
        onEnd?: (hasErrors: boolean, endRange: astn.Range, endData: astn.ObjectCloseData, contextData: astn.ContextData) => void,
        onUnexpectedProperty?: (key: string, range: astn.Range, contextData: astn.ContextData) => astn.RequiredValueHandler,
    ): astn.OnObject {
        return (beginRange: astn.Range, beginMetaData: astn.ObjectOpenData): astn.ObjectHandler => {
            if (onBegin) {
                onBegin(beginRange, beginMetaData)
            }
            if (beginMetaData.openCharacter !== "(") {
                this.raiseWarning(["expected token", { token: "open paren", found: beginMetaData.openCharacter }], beginRange)
            }
            const foundProperies: string[] = []
            let hasErrors = false
            return {
                property: (range: astn.Range, key: string, propertyContextData: astn.ContextData): p.IValue<astn.RequiredValueHandler> => {
                    const onProperty = (): astn.RequiredValueHandler => {
                        const expected = expectedProperties[key]
                        if (expected === undefined) {
                            hasErrors = true
                            this.raiseError(["unexpected property", { name: key }], range)
                            if (onUnexpectedProperty !== undefined) {
                                return onUnexpectedProperty(key, range, propertyContextData)
                            } else {
                                return {
                                    onValue: this.createDummyOnProperty(range, key, propertyContextData),
                                    onMissing: () => {
                                        //
                                    },
                                }
                            }
                        }
                        return expected.onExists(range, propertyContextData)
                    }
                    const process = (): astn.RequiredValueHandler => {
                        if (foundProperies.includes(key)) {
                            switch (this.duplicateEntrySeverity) {
                                case Severity.error:
                                    this.raiseError(["duplicate property", { name: key }], range)
                                    break
                                case Severity.nothing:
                                    break
                                case Severity.warning:
                                    this.raiseWarning(["duplicate property", { name: key }], range)
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
                    foundProperies.push(key)
                    return p.value(vh)
                },
                end: (endRange: astn.Range, endMetaData: astn.ObjectCloseData, endContextData: astn.ContextData): void => {
                    if (endMetaData.closeCharacter !== ")") {
                        this.raiseWarning(["expected token", { token: "close paren", found: endMetaData.closeCharacter }], endRange)
                    }
                    Object.keys(expectedProperties).forEach(epName => {
                        if (!foundProperies.includes(epName)) {
                            const ep = expectedProperties[epName]
                            if (ep.onNotExists === null) {
                                this.raiseError(["missing property", { name: epName }], beginRange)//FIX print location properly
                                hasErrors = true
                            } else {
                                ep.onNotExists(
                                    beginRange,
                                    beginMetaData,
                                    endRange,
                                    endMetaData
                                )
                            }
                        }
                    })
                    if (onEnd) {
                        onEnd(hasErrors, endRange, endMetaData, endContextData)
                    }
                },
            }
        }
    }
    public createShorthandTypeHandler(
        expectedElements: ExpectedElements,
        onBegin?: (beginRange: astn.Range, metaData: astn.ArrayOpenData) => void,
        onEnd?: (beginRange: astn.Range, metaData: astn.ArrayCloseData, contextData: astn.ContextData) => void
    ): astn.OnArray {
        return (beginRange: astn.Range, beginMetaData: astn.ArrayOpenData): astn.ArrayHandler => {
            if (onBegin) {
                onBegin(beginRange, beginMetaData)
            }
            if (beginMetaData.openCharacter !== "<") {
                this.raiseWarning(["expected token", { token: "open angle bracket", found: beginMetaData.openCharacter }], beginRange)
            }
            let index = 0
            return {
                element: (): astn.OnValue => {
                    const ee = expectedElements[index]
                    index++
                    if (ee === undefined) {
                        this.raiseError(["too many elements", { expected: expectedElements.length }], beginRange)//FIX print range properly
                        return this.createDummyValueHandler()
                    }
                    return ee().onValue
                },
                end: (endRange: astn.Range, endMetaData: astn.ArrayCloseData, endContextData: astn.ContextData): void => {
                    if (endMetaData.closeCharacter !== ">") {
                        this.raiseWarning(["expected token", { token: "close angle bracket", found: endMetaData.closeCharacter }], endRange)
                    }
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(["elements missing", {}], endRange)
                    }
                    for (let i = index; i !== expectedElements.length; i += 1) {
                        const ee = expectedElements[i]
                        ee().onMissing()
                    }
                    if (onEnd) {
                        onEnd(endRange, endMetaData, endContextData)
                    }
                },
            }
        }
    }
    public createListHandler(
        onElement: () => astn.OnValue,
        onBegin?: (beginRange: astn.Range, data: astn.ArrayOpenData) => void,
        onEnd?: (endRange: astn.Range, data: astn.ArrayCloseData, contextData: astn.ContextData) => void,
    ): astn.OnArray {
        return (beginRange: astn.Range, beginMetaData: astn.ArrayOpenData): astn.ArrayHandler => {
            if (onBegin) {
                onBegin(beginRange, beginMetaData)
            }
            if (beginMetaData.openCharacter !== "[") {
                this.raiseWarning(["expected token", { token: "open bracket", found: beginMetaData.openCharacter }], beginRange)
            }
            return {
                element: (): astn.OnValue => onElement(),
                end: (endRange: astn.Range, endData: astn.ArrayCloseData, endContextData: astn.ContextData): void => {
                    if (endData.closeCharacter !== "]") {
                        this.raiseWarning(["expected token", { token: "close bracket", found: endData.closeCharacter }], endRange)
                    }
                    if (onEnd) {
                        onEnd(endRange, endData, endContextData)
                    }
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
    //                                 return this.raiseError(`unknown option: '${value}'`, metaData.range)
    //                             }
    //                             dataHandler = optionHandler(
    //                                 {
    //                                     start: beginMetaData.start,
    //                                     optionRange: metaData.range,
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
            option: string,
            taggedUnionRange: astn.Range,
            optionRange: astn.Range,
            optionContextData: astn.ContextData
        ) => void,
        onMissingOption?: () => void,
    ): astn.OnTaggedUnion {
        return (taggedUnionRange: astn.Range): astn.TaggedUnionHandler => {
            return {
                option: (optionRange: astn.Range, option: string, optionContextData: astn.ContextData): astn.RequiredValueHandler => {

                    const optionHandler = options[option]
                    if (optionHandler === undefined) {
                        this.raiseError(["unknown option", { "found": option, "valid options": Object.keys(options) }], optionRange)
                        if (onUnexpectedOption !== undefined) {
                            onUnexpectedOption(
                                option,
                                taggedUnionRange,
                                optionRange,
                                optionContextData,
                            )
                        }
                        return this.createDummyRequiredValueHandler()
                    } else {
                        return optionHandler(taggedUnionRange, optionRange, optionContextData)
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
        expected: ExpectErrorValueType,
        onInvalidType?: OnInvalidType,
    ): astn.OnSimpleValue {
        return (range: astn.Range, _data: astn.SimpleValueData): p.IValue<boolean> => {
            if (onInvalidType !== undefined) {
                onInvalidType(range)
            } else {
                this.raiseError(["invalid value type", { found: "simple value", expected: expected }], range)
            }
            return p.value(false)
        }
    }
    public createUnexpectedTaggedUnionHandler(
        expected: ExpectErrorValueType,
        onInvalidType?: OnInvalidType,
    ): astn.OnTaggedUnion {
        return (): astn.TaggedUnionHandler => {
            return {
                option: (range: astn.Range, _option: string): astn.RequiredValueHandler => {
                    if (onInvalidType !== undefined) {
                        onInvalidType(range)
                    } else {
                        this.raiseError(["invalid value type", { found: "tagged union", expected: expected }], range)
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
        expected: ExpectErrorValueType,
        onInvalidType?: OnInvalidType,
    ): astn.OnObject {
        return (beginRange: astn.Range, _openData: astn.ObjectOpenData): astn.ObjectHandler => {
            return {
                property: (range: astn.Range, key: string, propertyContextData: astn.ContextData): p.IValue<astn.RequiredValueHandler> => {
                    return p.value({
                        onValue: this.createDummyOnProperty(range, key, propertyContextData),
                        onMissing: (): void => {
                            //
                        },
                    })
                },
                end: (endRange: astn.Range, _cd: astn.ObjectCloseData): void => {
                    if (onInvalidType !== undefined) {
                        onInvalidType(endRange)
                    } else {
                        this.raiseError(
                            ["invalid value type", { found: "object", expected: expected }],
                            astn.createRangeFromLocations(beginRange.start, astn.getEndLocationFromRange(endRange))
                        )
                    }
                },
            }
        }
    }
    public createUnexpectedArrayHandler(
        expected: ExpectErrorValueType,
        onInvalidType?: OnInvalidType,
    ): astn.OnArray {
        return (beginRange: astn.Range): astn.ArrayHandler => {
            return {
                element: (): astn.OnValue => {
                    return this.createDummyValueHandler()
                },
                end: (endRange: astn.Range, _cd: astn.ArrayCloseData): void => {
                    if (onInvalidType !== undefined) {
                        onInvalidType(endRange)
                    } else {
                        this.raiseError(["invalid value type", { found: "array", expected: expected }], astn.createRangeFromLocations(beginRange.start, astn.getEndLocationFromRange(endRange)))
                    }

                },
            }
        }
    }
    public expectNothing(
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("nothing", onInvalidType),
            object: this.createUnexpectedObjectHandler("nothing", onInvalidType),
            simpleValue: this.createUnexpectedSimpleValueHandler("nothing", onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("nothing", onInvalidType),
        }
    }
    public expectSimpleValueImp(
        expected: ExpectErrorValueType,
        callback: (
            range: astn.Range,
            metaData: astn.SimpleValueData,
        ) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler(expected, onInvalidType),
            object: this.createUnexpectedObjectHandler(expected, onInvalidType),
            simpleValue: callback,
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expected, onInvalidType),
        }
    }
    public expectSimpleValue(
        callback: (range: astn.Range, metaData: astn.SimpleValueData) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return this.expectSimpleValueImp("simple value", callback, onInvalidType)
    }
    public expectBoolean(
        callback: (value: boolean, range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return this.expectSimpleValueImp(
            "boolean",
            (range, metaData) => {
                if (metaData.quote !== null) {
                    if (onInvalidType) {
                        onInvalidType(range)
                    } else {
                        this.raiseError(["invalid simple value", { expected: "boolean", found: metaData.value }], range)
                    }
                    return p.value(false)
                }
                switch (metaData.value) {
                    case "true": {
                        return callback(true, range, metaData)
                    }
                    case "false": {
                        return callback(false, range, metaData)
                    }
                    default:

                        if (onInvalidType) {
                            onInvalidType(range)
                        } else {
                            this.raiseError(["invalid simple value", { expected: "boolean", found: metaData.value }], range)
                        }
                        return p.value(false)
                }
            },
            onInvalidType,
        )
    }
    public expectNull(
        callback: (range: astn.Range, metaData: astn.SimpleValueData) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return this.expectSimpleValueImp(
            "null",
            (range, data) => {
                if (data.quote !== null) {
                    if (onInvalidType) {
                        onInvalidType(range)
                    } else {
                        this.raiseError(["invalid simple value", { expected: "null", found: data.value }], range)
                    }
                    return p.value(false)
                }
                if (data.value === "null") {
                    return callback(range, data)
                } else {
                    if (onInvalidType) {
                        onInvalidType(range)
                    } else {
                        this.raiseError(["invalid simple value", { expected: "null", found: data.value }], range)
                    }
                    return p.value(false)
                }
            },
            onInvalidType
        )
    }
    public expectValue(
        onValue: astn.OnValue,
        onMissing?: () => void,
    ): astn.RequiredValueHandler {
        return {
            onValue: onValue,
            onMissing: onMissing
                ? onMissing
                : (): void => {
                    //
                },
        }
    }
    public expectNumber(
        callback: (value: number, range: astn.Range, svData: astn.SimpleValueData) => p.IValue<boolean>,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return this.expectSimpleValueImp(
            "number",
            (range, metaData) => {
                //eslint-disable-next-line
                const nr = new Number(metaData.value).valueOf()
                if (isNaN(nr)) {
                    if (onInvalidType) {
                        onInvalidType(range)
                    } else {
                        this.raiseError(["not a valid number", { value: metaData.value }], range)
                    }
                }
                return callback(nr, range, metaData)
            },
            onInvalidType
        )
    }
    public expectDictionary(
        onProperty: (key: string, range: astn.Range, contextData: astn.ContextData) => astn.RequiredValueHandler,
        onBegin?: (range: astn.Range, metaData: astn.ObjectOpenData) => void,
        onEnd?: (range: astn.Range, metaData: astn.ObjectCloseData, contextData: astn.ContextData) => void,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("dictionary", onInvalidType),
            object: this.createDictionaryHandler(onProperty, onBegin, onEnd),
            simpleValue: this.createUnexpectedSimpleValueHandler("dictionary", onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("dictionary", onInvalidType),
        }
    }
    public expectType(
        expectedProperties: ExpectedProperties = {},
        onBegin?: (range: astn.Range, openData: astn.ObjectOpenData) => void,
        onEnd?: (hasErrors: boolean, range: astn.Range, endData: astn.ObjectCloseData, contextData: astn.ContextData) => void,
        onUnexpectedProperty?: (key: string, range: astn.Range, contextData: astn.ContextData) => astn.RequiredValueHandler,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("type", onInvalidType),
            object: this.createTypeHandler(
                expectedProperties,
                onBegin,
                onEnd,
                onUnexpectedProperty
            ),
            simpleValue: this.createUnexpectedSimpleValueHandler("type", onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("type", onInvalidType),
        }
    }
    public expectList(
        onElement: () => astn.OnValue,
        onBegin?: (range: astn.Range, metaData: astn.ArrayOpenData) => void,
        onEnd?: (range: astn.Range, metaData: astn.ArrayCloseData, contextData: astn.ContextData) => void,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return {
            array: this.createListHandler(onElement, onBegin, onEnd),
            object: this.createUnexpectedObjectHandler("list", onInvalidType),
            simpleValue: this.createUnexpectedSimpleValueHandler("list", onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("list", onInvalidType),
        }
    }
    public expectShorthandType(
        expectedElements: ExpectedElements,
        onBegin?: (range: astn.Range, metaData: astn.ArrayOpenData) => void,
        onEnd?: (range: astn.Range, metaData: astn.ArrayCloseData, contextData: astn.ContextData) => void,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return {
            array: this.createShorthandTypeHandler(expectedElements, onBegin, onEnd),
            object: this.createUnexpectedObjectHandler("array type", onInvalidType),
            simpleValue: this.createUnexpectedSimpleValueHandler("array type", onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("array type", onInvalidType),
        }
    }

    public expectTypeOrShorthandType(
        expectedProperties: ExpectedProperties = {},
        expectedElements: ExpectedElements,
        onTypeBegin?: (range: astn.Range, openData: astn.ObjectOpenData) => void,
        onTypeEnd?: (hasErrors: boolean, range: astn.Range, endData: astn.ObjectCloseData, contextData: astn.ContextData) => void,
        onUnexpectedProperty?: (key: string, range: astn.Range, contextData: astn.ContextData) => astn.RequiredValueHandler,
        onShorthandTypeBegin?: (range: astn.Range, metaData: astn.ArrayOpenData) => void,
        onShorthandTypeEnd?: (range: astn.Range, metaData: astn.ArrayCloseData, contextData: astn.ContextData) => void,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return {
            array: this.createShorthandTypeHandler(expectedElements, onShorthandTypeBegin, onShorthandTypeEnd),
            object: this.createTypeHandler(
                expectedProperties,
                onTypeBegin,
                onTypeEnd,
                onUnexpectedProperty
            ),
            simpleValue: this.createUnexpectedSimpleValueHandler("type", onInvalidType),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("type", onInvalidType),
        }
    }
    public expectTaggedUnion(
        options: Options,
        onUnexpectedOption?: (
            option: string,
            taggedUnionRange: astn.Range,
            optionRange: astn.Range,
            optionContextData: astn.ContextData
        ) => void,
        onMissingOption?: () => void,
        onInvalidType?: OnInvalidType,
    ): astn.ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("tagged union", onInvalidType),
            object: this.createUnexpectedObjectHandler("tagged union", onInvalidType),
            simpleValue: this.createUnexpectedSimpleValueHandler("tagged union", onInvalidType),
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
