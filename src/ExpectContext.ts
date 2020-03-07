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
    Comment,
    ObjectHandler,
    ArrayHandler,
    OnSimpleValue,
} from "./attachments"
import { Range } from "./location"

export type IssueHandler = (message: string, range: Range) => void

export type ExpectedProperties = {
    [key: string]: {
        onExists: (metaData: PropertyData) => ValueHandler
        onNotExists: null | (() => void) //if onNotExists is null and the property does not exist, an error will be raised
    }
}

export type ExpectedElements = (() => ValueHandler)[]

export type Options = { [key: string]: (optionMetaData: TaggedUnionData, beginComments: Comment[], optionComments: Comment[]) => ValueHandler }

/**
 * ExpectContext is a class that helps processing a document that conforms to an expected structure
 * for example; if you expect and object with 2 properties, 'a' and 'b', both numbers, you could write it like this:
 *
 * const ec = new ExpectContext()
 * const handler = ec.expectType(
 *     {
 *         "a": ec.expectNumber(value => {
 *             //handle a
 *         }),
 *         "b": ec.expectNumber(value => {
 *             //handle b
 *         })
 *     },
 *     () => {
 *         //wrapup of type
 *     }
 * )
 * parser.
 */

export class ExpectContext {
    private readonly errorHandler: IssueHandler
    private readonly warningHandler: IssueHandler
    private readonly createDummyArrayHandler: (metaData: OpenData) => ArrayHandler
    private readonly createDummyObjectHandler: (metaData: OpenData) => ObjectHandler
    private readonly createDummyPropertyHandler: (key: string, metaData: PropertyData) => ValueHandler
    private readonly createDummyValueHandler: () => ValueHandler
    constructor(
        errorHandler: IssueHandler,
        warningHandler: IssueHandler,
        createDummyArrayHandler: (metaData: OpenData) => ArrayHandler,
        createDummyObjectHandler: (metaData: OpenData) => ObjectHandler,
        createDummyPropertyHandler: (key: string, metaData: PropertyData) => ValueHandler,
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
        onBegin: (metaData: OpenData) => void,
        onProperty: (key: string, metaData: PropertyData) => ValueHandler,
        onEnd: (metaData: CloseData) => void,
    ): OnObject {
        return beginMetaData => {
            onBegin(beginMetaData)
            if (beginMetaData.openCharacter !== "{") {
                this.raiseWarning(`expected '{' but found '${beginMetaData.openCharacter}'`, beginMetaData.start)
            }
            const foundEntries: string[] = []
            return {
                property: (key, metaData) => {
                    if (foundEntries.includes(key)) {
                        this.raiseWarning(`duplicate key '${key}'`, metaData.keyRange)
                    }
                    foundEntries.push(key)
                    return onProperty(key, metaData)
                },
                end: endMetaData => {
                    if (endMetaData.closeCharacter !== "}") {
                        this.raiseWarning(`expected '}' but found '${endMetaData.closeCharacter}'`, endMetaData.range)
                    }
                    onEnd(endMetaData)
                },
            }
        }
    }

    public createTypeHandler(
        onBegin: (range: Range, comments: Comment[]) => void,
        expectedProperties: ExpectedProperties,
        onEnd: (hasErrors: boolean, endRange: Range, comments: Comment[]) => void
    ): OnObject {
        return (beginMetaData, comments) => {
            onBegin(beginMetaData.start, comments)
            if (beginMetaData.openCharacter !== "(") {
                this.raiseWarning(`expected '(' but found '${beginMetaData.openCharacter}'`, beginMetaData.start)
            }
            const foundProperies: string[] = []
            let hasErrors = false
            return {
                property: (key, propMetaData) => {
                    if (foundProperies.includes(key)) {
                        hasErrors = true
                        this.raiseError(`property already processed: '${key}'`, propMetaData.keyRange)//FIX print range properly
                        return this.createDummyValueHandler()
                    }
                    foundProperies.push(key)
                    const expected = expectedProperties[key]
                    if (expected === undefined) {
                        hasErrors = true
                        this.raiseError(`unexpected property: '${key}'`, propMetaData.keyRange)//FIX print range properly
                        return this.createDummyPropertyHandler(key, propMetaData)
                    }
                    return expected.onExists(propMetaData)
                },
                end: (endMetaData, endComments) => {
                    if (endMetaData.closeCharacter !== ")") {
                        this.raiseWarning(`expected ')' but found '${endMetaData.closeCharacter}'`, endMetaData.range)
                    }
                    Object.keys(expectedProperties).forEach(epName => {
                        if (!foundProperies.includes(epName)) {
                            const ep = expectedProperties[epName]
                            if (ep.onNotExists === null) {
                                hasErrors = true
                                this.raiseError(`missing property: '${epName}'`, beginMetaData.start)//FIX print location properly
                            } else {
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
        onBegin: (metaData: OpenData) => void,
        expectedElements: ExpectedElements,
        onEnd: (metaData: CloseData) => void
    ): OnArray {
        return beginMetaData => {
            onBegin(beginMetaData)
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
                end: endMetaData => {
                    if (endMetaData.closeCharacter !== ">") {
                        this.raiseWarning(`expected '>' but found '${endMetaData.closeCharacter}'`, endMetaData.range)
                    }
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(`elements missing`, endMetaData.range)
                    }
                    onEnd(endMetaData)
                },
            }
        }
    }
    public createListHandler(
        onBegin: (metaData: OpenData) => void,
        onElement: () => ValueHandler,
        onEnd: (metaData: CloseData) => void,
    ): OnArray {
        return beginMetaData => {
            onBegin(beginMetaData)
            if (beginMetaData.openCharacter !== "[") {
                this.raiseWarning(`expected '[' but found '${beginMetaData.openCharacter}'`, beginMetaData.start)
            }
            return {
                element: () => onElement(),
                end: endMetaData => {
                    if (endMetaData.closeCharacter !== "]") {
                        this.raiseWarning(`expected ']' but found '${endMetaData.closeCharacter}'`, endMetaData.range)
                    }
                    onEnd(endMetaData)
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
        options: Options
    ): OnTaggedUnion {
        return (option: string, metaData: TaggedUnionData, beginComments: Comment[], optionComments: Comment[]) => {
            const optionHandler = options[option]
            if (optionHandler === undefined) {
                this.raiseError(`unknown option '${option}'`, metaData.optionRange)
                return this.createDummyValueHandler()
            } else {
                return optionHandler(metaData, beginComments, optionComments)
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
        return beginMetaData => {
            this.raiseError(`expected '${expected}' but found 'object'`, beginMetaData.start)
            return this.createDummyObjectHandler(beginMetaData)
        }
    }
    public createUnexpectedArrayHandler(expected: string): OnArray {
        return beginMetaData => {
            this.raiseError(`expected '${expected}' but found 'array'`, beginMetaData.start)
            return this.createDummyArrayHandler(beginMetaData)
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
    public expectSimpleValueImp(expected: string, callback: (value: string, metaData: StringData) => void): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler(expected),
            object: this.createUnexpectedObjectHandler(expected),
            simpleValue: callback,
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expected),
        }
    }
    public expectSimpleValue(callback: (value: string, metaData: StringData) => void): ValueHandler {
        return this.expectSimpleValueImp("simple value", callback)
    }
    public expectBoolean(callback: (value: boolean, metaData: StringData) => void): ValueHandler {
        return this.expectSimpleValueImp("boolean", (rawValue, metaData) => {
            if (metaData.quote !== null) {
                this.createUnexpectedSimpleValueHandler("boolean")
                return
            }
            switch (rawValue) {
                case "true": {
                    callback(true, metaData)
                    break
                }
                case "false": {
                    callback(false, metaData)
                    break
                }
                default:
                    this.createUnexpectedSimpleValueHandler("boolean")
            }
        })
    }
    public expectNull(callback: (metaData: StringData) => void): ValueHandler {
        return this.expectSimpleValueImp("null", (rawValue, metaData) => {
            if (rawValue === "null") {
                return callback(metaData)
            }
            return this.createUnexpectedSimpleValueHandler("null")
        })
    }
    public expectNumber(callback: (value: number, metaData: StringData) => void): ValueHandler {
        return this.expectSimpleValueImp("number", (rawValue, metaData) => {
            //eslint-disable-next-line
            const nr = new Number(rawValue).valueOf()
            if (isNaN(nr)) {
                return this.createUnexpectedSimpleValueHandler("unquoted token")
            }
            return callback(nr, metaData)
        })
    }
    public expectDictionary(
        onBegin: (metaData: OpenData) => void,
        onProperty: (key: string, metaData: PropertyData) => ValueHandler,
        onEnd: (metaData: CloseData) => void,
    ): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("dictionary"),
            object: this.createDictionaryHandler(onBegin, onProperty, onEnd),
            simpleValue: this.createUnexpectedSimpleValueHandler("dictionary"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("dictionary"),
        }
    }
    public expectType(
        onBegin: (range: Range, comments: Comment[]) => void,
        expectedProperties: ExpectedProperties,
        onEnd: (hasErrors: boolean, endRange: Range, comments: Comment[]) => void,
    ): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("type"),
            object: this.createTypeHandler(onBegin, expectedProperties, onEnd),
            simpleValue: this.createUnexpectedSimpleValueHandler("type"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("type"),
        }
    }
    public expectList(
        onBegin: (metaData: OpenData) => void,
        onElement: () => ValueHandler,
        onEnd: (metaData: CloseData) => void,
    ): ValueHandler {
        return {
            array: this.createListHandler(onBegin, onElement, onEnd),
            object: this.createUnexpectedObjectHandler("list"),
            simpleValue: this.createUnexpectedSimpleValueHandler("list"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("list"),
        }
    }
    public expectArrayType(
        onBegin: (metaData: OpenData) => void,
        expectedElements: ExpectedElements,
        onEnd: (metaData: CloseData) => void,
    ): ValueHandler {
        return {
            array: this.createArrayTypeHandler(onBegin, expectedElements, onEnd),
            object: this.createUnexpectedObjectHandler("array type"),
            simpleValue: this.createUnexpectedSimpleValueHandler("array type"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("array type"),
        }
    }
    public expectTaggedUnion(options: Options): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("tagged union"),
            object: this.createUnexpectedObjectHandler("tagged union"),
            simpleValue: this.createUnexpectedSimpleValueHandler("tagged union"),
            taggedUnion: this.createTaggedUnionHandler(options),
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
