/* eslint
    max-classes-per-file: "off",
*/
import {
    ValueHandler,
    createDummyObjectHandler,
    createDummyArrayHandler,
    createDummyValueHandler,
    OnObject,
    OnArray,
    OnQuotedString,
    OnUnquotedToken,
    OnTaggedUnion,
    Comment,
} from "./attachments"
import { Range } from "./location"

export type IssueHandler = (message: string, range: Range) => void

export type ExpectedProperties = {
    [key: string]: {
        onExists: (range: Range, comments: Comment[]) => ValueHandler
        onNotExists: null | (() => void) //if onNotExists is null and the property does not exist, an error will be raised
    }
}

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
    constructor(errorHandler: IssueHandler, warningHandler: IssueHandler) {
        this.errorHandler = errorHandler
        this.warningHandler = warningHandler
    }
    public raiseWarning(message: string, range: Range) {
        this.warningHandler(message, range)
    }
    public raiseError(message: string, range: Range): void {
        this.errorHandler(message, range)
    }
    public createDictionaryHandler(
        onBegin: (range: Range, comments: Comment[]) => void,
        onProperty: (key: string, range: Range, comments: Comment[]) => ValueHandler,
        onEnd: (endRange: Range, comments: Comment[]) => void,
    ): OnObject {
        return (startRange, openCharacter, beginComments) => {
            onBegin(startRange, beginComments)
            if (openCharacter !== "{") {
                this.raiseWarning(`expected '{' but found '${openCharacter}'`, startRange)
            }
            const foundEntries: string[] = []
            return {
                property: (key, range, comments) => {
                    if (foundEntries.includes(key)) {
                        this.raiseWarning(`duplicate key '${key}'`, range)
                    }
                    foundEntries.push(key)
                    return onProperty(key, range, comments)
                },
                end: (endRange, closeCharacter, comments) => {
                    if (closeCharacter !== "}") {
                        this.raiseWarning(`expected '}' but found '${closeCharacter}'`, endRange)
                    }
                    onEnd(endRange, comments)
                },
            }
        }
    }

    public createTypeHandler(
        onBegin: (range: Range, comments: Comment[]) => void,
        expectedProperties: ExpectedProperties,
        onEnd: (hasErrors: boolean, endRange: Range, comments: Comment[]) => void
    ): OnObject {
        return (startRange, openCharacter, beginComments) => {
            onBegin(startRange, beginComments)
            if (openCharacter !== "(") {
                this.raiseWarning(`expected '(' but found '${openCharacter}'`, startRange)
            }
            const foundProperies: string[] = []
            let hasErrors = false
            return {
                property: (key, range, comments) => {
                    if (foundProperies.includes(key)) {
                        hasErrors = true
                        this.raiseError(`property already processed: '${key}'`, range)//FIX print range properly
                        return createDummyValueHandler()
                    }
                    foundProperies.push(key)
                    const expected = expectedProperties[key]
                    if (expected === undefined) {
                        hasErrors = true
                        this.raiseError(`unexpected property: '${key}'`, range)//FIX print range properly
                        return createDummyValueHandler()
                    }
                    return expected.onExists(range, comments)
                },
                end: (endRange, closeCharacter, comments) => {
                    if (closeCharacter !== ")") {
                        this.raiseWarning(`expected ')' but found '${closeCharacter}'`, endRange)
                    }
                    Object.keys(expectedProperties).forEach(epName => {
                        if (!foundProperies.includes(epName)) {
                            const ep = expectedProperties[epName]
                            if (ep.onNotExists === null) {
                                hasErrors = true
                                this.raiseError(`missing property: '${epName}'`, startRange)//FIX print location properly
                            } else {
                                ep.onNotExists()
                            }
                        }
                    })
                    onEnd(hasErrors, endRange, comments)
                },
            }
        }
    }
    public createArrayTypeHandler(
        onBegin: (range: Range, comments: Comment[]) => void,
        expectedElements: ((range: Range, comments: Comment[]) => ValueHandler)[],
        onEnd: (range: Range, comments: Comment[]) => void
    ): OnArray {
        return (startRange, openCharacter, startComments) => {
            onBegin(startRange, startComments)
            if (openCharacter !== "<") {
                this.raiseWarning(`expected '<' but found '${openCharacter}'`, startRange)
            }
            let index = 0
            return {
                element: (range, comments) => {
                    const ee = expectedElements[index]
                    index++
                    if (ee === undefined) {
                        this.raiseError(`found more than the expected ${expectedElements.length} element(s)`, startRange)//FIX print range properly
                        return createDummyValueHandler()
                    }
                    return ee(range, comments)
                },
                end: (endRange, closeCharacter, endComments) => {
                    if (closeCharacter !== ">") {
                        this.raiseWarning(`expected '>' but found '${closeCharacter}'`, endRange)
                    }
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(`elements missing`, endRange)
                    }
                    onEnd(endRange, endComments)
                },
            }
        }
    }
    public createListHandler(
        onBegin: (range: Range, comments: Comment[]) => void,
        onElement: (start: Range, comments: Comment[]) => ValueHandler,
        onEnd: (range: Range, comments: Comment[]) => void,
    ): OnArray {
        return (startRange, openCharacter, startComments) => {
            onBegin(startRange, startComments)
            if (openCharacter !== "[") {
                this.raiseWarning(`expected '[' but found '${openCharacter}'`, startRange)
            }
            return {
                element: (elementStartRange, comments) => onElement(elementStartRange, comments),
                end: (endRange, closeCharacter, endComments) => {
                    if (closeCharacter !== "]") {
                        this.raiseWarning(`expected ']' but found '${closeCharacter}'`, endRange)
                    }
                    onEnd(endRange, endComments)
                },
            }
        }
    }
    public createTaggedUnionSurrogateHandler(
        options: { [key: string]: (startRange: Range, unionComments: Comment[], optionRange: Range, optionComments: Comment[]) => ValueHandler }
    ): OnArray {
        return () => {
            let dataHandler: ValueHandler | null = null
            return {
                element: (startRange, tuComments) => {
                    return {
                        array: (startLocation, openCharacter, dataComments, pauser) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected array`, startLocation)
                                return createDummyArrayHandler()
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.array(startLocation, openCharacter, dataComments, pauser)
                        },
                        object: (startLocation, openCharacter, dataComments, pauser) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected object`, startLocation)
                                return createDummyObjectHandler()
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.object(startLocation, openCharacter, dataComments, pauser)
                        },
                        unquotedToken: (value, dataRange, dataComments, pauser) => {
                            if (dataHandler === null) {
                                return this.raiseError(`expected string`, dataRange)
                            } else {
                                dataHandler.unquotedToken(value, dataRange, dataComments, pauser)
                            }
                        },
                        quotedString: (value, range, dataComments, pauser) => {
                            if (dataHandler === null) {
                                //found the option
                                const optionHandler = options[value]
                                if (optionHandler === undefined) {
                                    return this.raiseError(`unknown option: '${value}'`, range)
                                }
                                dataHandler = optionHandler(startRange, tuComments, range, dataComments)
                            } else {
                                dataHandler.quotedString(value, range, dataComments, pauser)
                            }
                        },
                        taggedUnion: (option, subTuRange, subTuComments, dataRange, dataComments, pauser) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected tagged union`, startRange)
                                return createDummyValueHandler()
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.taggedUnion(option, subTuRange, subTuComments, dataRange, dataComments, pauser)
                        },
                    }
                },
                end: endRange => {
                    if (dataHandler === null) {
                        this.raiseError(`missing option`, endRange)
                    }
                },
            }
        }
    }
    public createTaggedUnionHandler(
        options: { [key: string]: (startRange: Range, unionComments: Comment[], optionRange: Range, comments: Comment[]) => ValueHandler }
    ): OnTaggedUnion {
        return (option: string, tuStartRange: Range, tuComments: Comment[], optionRange: Range, optionComments: Comment[]) => {
            const optionHandler = options[option]
            if (optionHandler === undefined) {
                this.raiseError(`unknown option '${option}'`, optionRange)
                return createDummyValueHandler()
            } else {
                return optionHandler(tuStartRange, tuComments, optionRange, optionComments)
            }
        }
    }
    public createUnexpectedunquotedTokenHandler(expected: string): OnUnquotedToken {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'unquoted token'`, range)
    }
    public createUnexpectedQuotedStringHandler(expected: string): OnQuotedString {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'string'`, range)
    }
    public createUnexpectedTaggedUnionHandler(expected: string): OnTaggedUnion {
        return (_option, location) => {
            this.raiseError(`expected '${expected}' but found 'tagged union'`, location)
            return createDummyValueHandler()
        }
    }
    public createUnexpectedObjectHandler(expected: string): OnObject {
        return startLocation => {
            this.raiseError(`expected '${expected}' but found 'object'`, startLocation)
            return createDummyObjectHandler()
        }
    }
    public createUnexpectedArrayHandler(expected: string): OnArray {
        return startLocation => {
            this.raiseError(`expected '${expected}' but found 'array'`, startLocation)
            return createDummyArrayHandler()
        }
    }
    public expectNothing(): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("nothing"),
            object: this.createUnexpectedObjectHandler("nothing"),
            unquotedToken: this.createUnexpectedunquotedTokenHandler("nothing"),
            quotedString: this.createUnexpectedQuotedStringHandler("nothing"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("nothing"),
        }
    }
    public expectQuotedString(callback: (value: string, range: Range, comments: Comment[]) => void): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("string"),
            object: this.createUnexpectedObjectHandler("string"),
            unquotedToken: this.createUnexpectedunquotedTokenHandler("string"),
            quotedString: callback,
            taggedUnion: this.createUnexpectedTaggedUnionHandler("string"),
        }
    }
    public expectUnquotedToken(expectString: string, callback: (value: string, range: Range, comments: Comment[]) => void): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler(expectString),
            object: this.createUnexpectedObjectHandler(expectString),
            unquotedToken: callback,
            quotedString: this.createUnexpectedQuotedStringHandler(expectString),
            taggedUnion: this.createUnexpectedTaggedUnionHandler(expectString),
        }
    }
    public expectSimpleValue(callback: (value: string, quoted: boolean, range: Range, comments: Comment[]) => void): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("simple value"),
            object: this.createUnexpectedObjectHandler("simple value"),
            unquotedToken: (value, range, comments) => {
                return callback(value, false, range, comments)
            },
            quotedString: (value, range, comments) => {
                return callback(value, true, range, comments)
            },
            taggedUnion: this.createUnexpectedTaggedUnionHandler("simple value"),
        }
    }
    public expectBoolean(callback: (value: boolean, range: Range, comments: Comment[]) => void): ValueHandler {
        return this.expectUnquotedToken("boolean", (rawValue, range, comments) => {
            switch (rawValue) {
                case "true": {
                    return callback(true, range, comments)
                }
                case "false": {
                    return callback(false, range, comments)
                }
                default:
                    return this.createUnexpectedunquotedTokenHandler("boolean")
            }
        })
    }
    public expectNull(callback: (range: Range, comments: Comment[]) => void): ValueHandler {
        return this.expectUnquotedToken("null", (rawValue, range, comments) => {
            if (rawValue === "null") {
                return callback(range, comments)
            }
            return this.createUnexpectedunquotedTokenHandler("null")
        })
    }
    public expectNumber(callback: (value: number, range: Range, comments: Comment[]) => void): ValueHandler {
        return this.expectUnquotedToken("number", (rawValue, range, comments) => {
            //eslint-disable-next-line
            const nr = new Number(rawValue).valueOf()
            if (isNaN(nr)) {
                return this.createUnexpectedunquotedTokenHandler("unquoted token")
            }
            return callback(nr, range, comments)
        })
    }
    public expectDictionary(
        onBegin: (range: Range, comments: Comment[]) => void,
        onProperty: (key: string, range: Range, comments: Comment[]) => ValueHandler,
        onEnd: (endRange: Range, comments: Comment[]) => void,
    ): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("dictionary"),
            object: this.createDictionaryHandler(onBegin, onProperty, onEnd),
            unquotedToken: this.createUnexpectedunquotedTokenHandler("dictionary"),
            quotedString: this.createUnexpectedQuotedStringHandler("dictionary"),
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
            unquotedToken: this.createUnexpectedunquotedTokenHandler("type"),
            quotedString: this.createUnexpectedQuotedStringHandler("type"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("type"),
        }
    }
    public expectList(
        onBegin: (range: Range, comments: Comment[]) => void,
        onElement: (startLocation: Range, comments: Comment[]) => ValueHandler,
        onEnd: (endRange: Range, comments: Comment[]) => void,
    ): ValueHandler {
        return {
            array: this.createListHandler(onBegin, onElement, onEnd),
            object: this.createUnexpectedObjectHandler("list"),
            unquotedToken: this.createUnexpectedunquotedTokenHandler("list"),
            quotedString: this.createUnexpectedQuotedStringHandler("list"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("list"),
        }
    }
    public expectArrayType(
        onBegin: (range: Range, comments: Comment[]) => void,
        expectedElements: ((range: Range, comments: Comment[]) => ValueHandler)[],
        onEnd: (range: Range, comments: Comment[]) => void,
    ): ValueHandler {
        return {
            array: this.createArrayTypeHandler(onBegin, expectedElements, onEnd),
            object: this.createUnexpectedObjectHandler("array type"),
            unquotedToken: this.createUnexpectedunquotedTokenHandler("array type"),
            quotedString: this.createUnexpectedQuotedStringHandler("array type"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("array type"),
        }
    }
    public expectTaggedUnion(options: { [key: string]: (tuStartRange: Range, tuComments: Comment[], optionRange: Range, comments: Comment[]) => ValueHandler }): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("tagged union"),
            object: this.createUnexpectedObjectHandler("tagged union"),
            unquotedToken: this.createUnexpectedunquotedTokenHandler("tagged union"),
            quotedString: this.createUnexpectedQuotedStringHandler("tagged union"),
            taggedUnion: this.createTaggedUnionHandler(options),
        }
    }
    /**
     * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
     * @param callback
     */
    public expectTaggedUnionOrArraySurrogate(
        options: { [key: string]: (tuStartRange: Range, tuComments: Comment[], optionRange: Range, comments: Comment[]) => ValueHandler }
    ): ValueHandler {
        return {
            array: this.createTaggedUnionSurrogateHandler(options),
            object: this.createUnexpectedObjectHandler("tagged union"),
            unquotedToken: this.createUnexpectedunquotedTokenHandler("tagged union"),
            quotedString: this.createUnexpectedQuotedStringHandler("tagged union"),
            taggedUnion: this.createTaggedUnionHandler(options),
        }
    }
}
