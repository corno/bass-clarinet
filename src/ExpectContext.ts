/* eslint
    max-classes-per-file: "off",
*/
import {
    OpenData,
    CloseData,
    PropertyData,
    StringData,
    TaggedUnionData,
} from "./IDataSubscriber"
import {
    ValueHandler,
    OnObject,
    OnArray,
    OnTaggedUnion,
    ObjectHandler,
    ArrayHandler,
    OnSimpleValue,
    PreData,
} from "./attachments"
import { Range } from "./location"

export type IssueHandler = (message: string, range: Range) => void

export type ExpectedProperties = {
    [key: string]: {
        onExists: (metaData: PropertyData, preData: PreData) => ValueHandler
        onNotExists: null | (() => void) //if onNotExists is null and the property does not exist, an error will be raised
    }
}

export type ExpectedElements = (() => ValueHandler)[]

export type Options = { [key: string]: (optionMetaData: TaggedUnionData, beginPreData: PreData, optionPreData: PreData) => ValueHandler }

export class ExpectContext {
    private readonly errorHandler: IssueHandler
    private readonly warningHandler: IssueHandler
    private readonly createDummyArrayHandler: (metaData: OpenData, preData: PreData) => ArrayHandler
    private readonly createDummyObjectHandler: (metaData: OpenData, preData: PreData) => ObjectHandler
    private readonly createDummyPropertyHandler: (key: string, metaData: PropertyData, preData: PreData) => ValueHandler
    private readonly createDummyValueHandler: () => ValueHandler
    constructor(
        errorHandler: IssueHandler,
        warningHandler: IssueHandler,
        createDummyArrayHandler: (metaData: OpenData, preData: PreData) => ArrayHandler,
        createDummyObjectHandler: (metaData: OpenData, preData: PreData) => ObjectHandler,
        createDummyPropertyHandler: (key: string, metaData: PropertyData, preData: PreData) => ValueHandler,
        createDummyValueHandler: () => ValueHandler,
    ) {
        this.errorHandler = errorHandler
        this.warningHandler = warningHandler
        this.createDummyArrayHandler = createDummyArrayHandler
        this.createDummyObjectHandler = createDummyObjectHandler
        this.createDummyPropertyHandler = createDummyPropertyHandler
        this.createDummyValueHandler = createDummyValueHandler
    }
    public raiseWarning(message: string, range: Range) {
        this.warningHandler(message, range)
    }
    public raiseError(message: string, range: Range): void {
        this.errorHandler(message, range)
    }
    public createDictionaryHandler(
        onBegin: (metaData: OpenData, preData: PreData) => void,
        onProperty: (key: string, metaData: PropertyData, preData: PreData) => ValueHandler,
        onEnd: (metaData: CloseData, preData: PreData) => void,
    ): OnObject {
        return (beginMetaData, beginPreData) => {
            onBegin(beginMetaData, beginPreData)
            if (beginMetaData.openCharacter !== "{") {
                this.raiseWarning(`expected '{' but found '${beginMetaData.openCharacter}'`, beginMetaData.start)
            }
            const foundEntries: string[] = []
            return {
                property: (key, metaData, preData) => {
                    if (foundEntries.includes(key)) {
                        this.raiseWarning(`duplicate key '${key}'`, metaData.keyRange)
                    }
                    foundEntries.push(key)
                    return onProperty(key, metaData, preData)
                },
                end: (endMetaData, endPreData) => {
                    if (endMetaData.closeCharacter !== "}") {
                        this.raiseWarning(`expected '}' but found '${endMetaData.closeCharacter}'`, endMetaData.range)
                    }
                    onEnd(endMetaData, endPreData)
                },
            }
        }
    }

    public createTypeHandler(
        onBegin: (range: Range, preData: PreData) => void,
        expectedProperties: ExpectedProperties,
        onEnd: (hasErrors: boolean, endRange: Range, preData: PreData) => void,
        onUnexpectedProperty?: (key: string, metaData: PropertyData, preData: PreData) => void,
    ): OnObject {
        return (beginMetaData, preData) => {
            onBegin(beginMetaData.start, preData)
            if (beginMetaData.openCharacter !== "(") {
                this.raiseWarning(`expected '(' but found '${beginMetaData.openCharacter}'`, beginMetaData.start)
            }
            const foundProperies: string[] = []
            let hasErrors = false
            return {
                property: (key, propMetaData, propertyPreData) => {
                    if (foundProperies.includes(key)) {
                        hasErrors = true
                        this.raiseError(`duplicate property: '${key}'`, propMetaData.keyRange)//FIX print range properly
                        return this.createDummyValueHandler()
                    }
                    foundProperies.push(key)
                    const expected = expectedProperties[key]
                    if (expected === undefined) {
                        hasErrors = true
                        if (onUnexpectedProperty !== undefined) {
                            onUnexpectedProperty(key, propMetaData, propertyPreData)
                        }
                        this.raiseError(`unexpected property: '${key}'`, propMetaData.keyRange)//FIX print range properly
                        return this.createDummyPropertyHandler(key, propMetaData, propertyPreData)
                    }
                    return expected.onExists(propMetaData, propertyPreData)
                },
                end: (endMetaData, endComments) => {
                    if (endMetaData.closeCharacter !== ")") {
                        this.raiseWarning(`expected ')' but found '${endMetaData.closeCharacter}'`, endMetaData.range)
                    }
                    Object.keys(expectedProperties).forEach(epName => {
                        if (!foundProperies.includes(epName)) {
                            const ep = expectedProperties[epName]
                            this.raiseError(`missing property: '${epName}'`, beginMetaData.start)//FIX print location properly
                            hasErrors = true
                            if (ep.onNotExists !== null) {
                                ep.onNotExists()
                            }
                        }
                    })
                    onEnd(hasErrors, endMetaData.range, endComments)
                },
            }
        }
    }
    public createArrayTypeHandler(
        onBegin: (metaData: OpenData, preData: PreData) => void,
        expectedElements: ExpectedElements,
        onEnd: (metaData: CloseData, preData: PreData) => void
    ): OnArray {
        return (beginMetaData, beginPreData) => {
            onBegin(beginMetaData, beginPreData)
            if (beginMetaData.openCharacter !== "<") {
                this.raiseWarning(`expected '<' but found '${beginMetaData.openCharacter}'`, beginMetaData.start)
            }
            let index = 0
            return {
                element: () => {
                    const ee = expectedElements[index]
                    index++
                    if (ee === undefined) {
                        this.raiseError(`found more than the expected ${expectedElements.length} element(s)`, beginMetaData.start)//FIX print range properly
                        return this.createDummyValueHandler()
                    }
                    return ee()
                },
                end: (endMetaData, endPreData) => {
                    if (endMetaData.closeCharacter !== ">") {
                        this.raiseWarning(`expected '>' but found '${endMetaData.closeCharacter}'`, endMetaData.range)
                    }
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(`elements missing`, endMetaData.range)
                    }
                    onEnd(endMetaData, endPreData)
                },
            }
        }
    }
    public createListHandler(
        onBegin: (metaData: OpenData, preData: PreData) => void,
        onElement: () => ValueHandler,
        onEnd: (metaData: CloseData, preData: PreData) => void,
    ): OnArray {
        return (beginMetaData, beginPreData) => {
            onBegin(beginMetaData, beginPreData)
            if (beginMetaData.openCharacter !== "[") {
                this.raiseWarning(`expected '[' but found '${beginMetaData.openCharacter}'`, beginMetaData.start)
            }
            return {
                element: () => onElement(),
                end: (endMetaData, endPreData) => {
                    if (endMetaData.closeCharacter !== "]") {
                        this.raiseWarning(`expected ']' but found '${endMetaData.closeCharacter}'`, endMetaData.range)
                    }
                    onEnd(endMetaData, endPreData)
                },
            }
        }
    }
    // public createTaggedUnionSurrogateHandler(
    //     options: Options
    // ): OnArray {
    //     return (beginMetaData, beginComments) => {
    //         let dataHandler: ValueHandler | null = null
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
        onUnexpectedOption?: (option: string, metaData: TaggedUnionData, beginPreData: PreData, optionPreData: PreData) => void,
    ): OnTaggedUnion {
        return (option: string, metaData: TaggedUnionData, beginPreData: PreData, optionPreData: PreData) => {
            const optionHandler = options[option]
            if (optionHandler === undefined) {
                this.raiseError(`unknown option '${option}', choose from ${Object.keys(options).map(opt => `'${opt}'`).join(", ")} `, metaData.optionRange)
                if (onUnexpectedOption !== undefined) {
                    onUnexpectedOption(option, metaData, beginPreData, optionPreData)
                }
                return this.createDummyValueHandler()
            } else {
                return optionHandler(metaData, beginPreData, optionPreData)
            }
        }
    }
    public createUnexpectedSimpleValueHandler(expected: string): OnSimpleValue {
        return (_value, metaData) => this.raiseError(`expected '${expected}' but found simple value`, metaData.range)
    }
    public createUnexpectedTaggedUnionHandler(expected: string): OnTaggedUnion {
        return (_option, metaData) => {
            this.raiseError(`expected '${expected}' but found 'tagged union'`, metaData.startRange)
            return this.createDummyValueHandler()
        }
    }
    public createUnexpectedObjectHandler(expected: string): OnObject {
        return (beginMetaData, comments) => {
            this.raiseError(`expected '${expected}' but found 'object'`, beginMetaData.start)
            return this.createDummyObjectHandler(beginMetaData, comments)
        }
    }
    public createUnexpectedArrayHandler(expected: string): OnArray {
        return (beginMetaData, comments) => {
            this.raiseError(`expected '${expected}' but found 'array'`, beginMetaData.start)
            return this.createDummyArrayHandler(beginMetaData, comments)
        }
    }
    public expectNothing(): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("nothing"),
            object: this.createUnexpectedObjectHandler("nothing"),
            simpleValue: this.createUnexpectedSimpleValueHandler("nothing"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("nothing"),
        }
    }
    public expectSimpleValueImp(expected: string, callback: (value: string, metaData: StringData, preData: PreData) => void): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler(expected),
            object: this.createUnexpectedObjectHandler(expected),
            simpleValue: callback,
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expected),
        }
    }
    public expectSimpleValue(callback: (value: string, metaData: StringData, preData: PreData) => void): ValueHandler {
        return this.expectSimpleValueImp("simple value", callback)
    }
    public expectBoolean(callback: (value: boolean, metaData: StringData, preData: PreData) => void): ValueHandler {
        return this.expectSimpleValueImp("boolean", (rawValue, metaData, preData) => {
            if (metaData.quote !== null) {
                this.createUnexpectedSimpleValueHandler("boolean")
                return
            }
            switch (rawValue) {
                case "true": {
                    callback(true, metaData, preData)
                    break
                }
                case "false": {
                    callback(false, metaData, preData)
                    break
                }
                default:
                    this.createUnexpectedSimpleValueHandler("boolean")
            }
        })
    }
    public expectNull(callback: (metaData: StringData, preData: PreData) => void): ValueHandler {
        return this.expectSimpleValueImp("null", (rawValue, metaData, preData) => {
            if (rawValue === "null") {
                return callback(metaData, preData)
            }
            return this.createUnexpectedSimpleValueHandler("null")
        })
    }
    public expectNumber(callback: (value: number, metaData: StringData, preData: PreData) => void): ValueHandler {
        return this.expectSimpleValueImp("number", (rawValue, metaData, preData) => {
            //eslint-disable-next-line
            const nr = new Number(rawValue).valueOf()
            if (isNaN(nr)) {
                return this.createUnexpectedSimpleValueHandler("unquoted token")
            }
            return callback(nr, metaData, preData)
        })
    }
    public expectDictionary(
        onBegin: (metaData: OpenData, preData: PreData) => void,
        onProperty: (key: string, metaData: PropertyData, preData: PreData) => ValueHandler,
        onEnd: (metaData: CloseData, preData: PreData) => void,
    ): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("dictionary"),
            object: this.createDictionaryHandler(onBegin, onProperty, onEnd),
            simpleValue: this.createUnexpectedSimpleValueHandler("dictionary"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("dictionary"),
        }
    }
    public expectType(
        onBegin: (range: Range, preData: PreData) => void,
        expectedProperties: ExpectedProperties,
        onEnd: (hasErrors: boolean, endRange: Range, preData: PreData) => void,
        onUnexpectedProperty?: (key: string, metaData: PropertyData, preData: PreData) => void,
    ): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("type"),
            object: this.createTypeHandler(onBegin, expectedProperties, onEnd, onUnexpectedProperty),
            simpleValue: this.createUnexpectedSimpleValueHandler("type"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("type"),
        }
    }
    public expectList(
        onBegin: (metaData: OpenData, preData: PreData) => void,
        onElement: () => ValueHandler,
        onEnd: (metaData: CloseData, preData: PreData) => void,
    ): ValueHandler {
        return {
            array: this.createListHandler(onBegin, onElement, onEnd),
            object: this.createUnexpectedObjectHandler("list"),
            simpleValue: this.createUnexpectedSimpleValueHandler("list"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("list"),
        }
    }
    public expectArrayType(
        onBegin: (metaData: OpenData, preData: PreData) => void,
        expectedElements: ExpectedElements,
        onEnd: (metaData: CloseData, preData: PreData) => void,
    ): ValueHandler {
        return {
            array: this.createArrayTypeHandler(onBegin, expectedElements, onEnd),
            object: this.createUnexpectedObjectHandler("array type"),
            simpleValue: this.createUnexpectedSimpleValueHandler("array type"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("array type"),
        }
    }
    public expectTaggedUnion(
        options: Options,
        onUnexpectedOption?: (option: string, metaData: TaggedUnionData, beginPreData: PreData, optionPreData: PreData) => void,
    ): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("tagged union"),
            object: this.createUnexpectedObjectHandler("tagged union"),
            simpleValue: this.createUnexpectedSimpleValueHandler("tagged union"),
            taggedUnion: this.createTaggedUnionHandler(options, onUnexpectedOption),
        }
    }
    // /**
    //  * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
    //  * @param callback
    //  */
    // public expectTaggedUnionOrArraySurrogate(
    //     options: Options
    // ): ValueHandler {
    //     return {
    //         array: this.createTaggedUnionSurrogateHandler(options),
    //         object: this.createUnexpectedObjectHandler("tagged union"),
    //         simpleValue: this.createUnexpectedSimpleValueHandler("tagged union"),
    //         taggedUnion: this.createTaggedUnionHandler(options),
    //     }
    // }
}
