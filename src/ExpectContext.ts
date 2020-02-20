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
    OnBoolean,
    OnNumber,
    OnString,
    OnNull,
    OnTaggedUnion,
    Comment,
} from "./stackedDataSubscriber"
import { Range } from "./location"
import { RangeError } from "./errors"

export type IssueHandler = (message: string, range: Range) => void

type NullHandler = (range: Range) => void

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
    private readonly errorHandler: null | IssueHandler
    private readonly warningHandler: null | IssueHandler
    /**
     *
     * @param errorHandler if provided (not null), the errors are reported to this handler
     * and no errors are thrown
     * if not provided (null), this Context will throw errors
     */
    constructor(errorHandler: null | IssueHandler, warningHandler: null | IssueHandler) {
        this.errorHandler = errorHandler
        this.warningHandler = warningHandler
    }
    public raiseWarning(message: string, range: Range) {
        if (this.warningHandler === null) {
            throw new RangeError(message, range)
        }
        this.warningHandler(message, range)
    }
    public raiseError(message: string, range: Range): void {
        if (this.errorHandler === null) {
            throw new RangeError(message, range)
        }
        this.errorHandler(message, range)
    }

    public createDictionaryHandler(onProperty: (key: string, range: Range, comments: Comment[]) => ValueHandler): OnObject {
        return (start, openCharacter) => {
            if (openCharacter !== "{") {
                this.raiseWarning(`expected '{' but found '${openCharacter}'`, start)
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
                end: (endRange, closeCharacter) => {
                    if (closeCharacter !== "}") {
                        this.raiseWarning(`expected '}' but found '${closeCharacter}'`, endRange)
                    }
                },
            }
        }
    }

    public createTypeHandler(expectedProperties: { [key: string]: ValueHandler }, onEnd: (hasErrors: boolean, comments: Comment[]) => void): OnObject {
        return (startRange, openCharacter) => {
            if (openCharacter !== "(") {
                this.raiseWarning(`expected '(' but found '${openCharacter}'`, startRange)
            }
            const foundProperies: string[] = []
            let hasErrors = false
            return {
                property: (key, range) => {
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
                    return expected
                },
                end: (endRange, closeCharacter, comments) => {

                    if (closeCharacter !== ")") {
                        this.raiseWarning(`expected ')' but found '${closeCharacter}'`, endRange)
                    }
                    Object.keys(expectedProperties).forEach(ep => {
                        if (!foundProperies.includes(ep)) {
                            hasErrors = true
                            this.raiseError(`missing property: '${ep}'`, startRange)//FIX print location properly
                        }
                    })
                    onEnd(hasErrors, comments)
                },
            }
        }
    }

    public createArrayTypeHandler(expectedElements: ValueHandler[], onEnd: (comments: Comment[]) => void): OnArray {
        return (startRange, openCharacter) => {
            if (openCharacter !== "<") {
                this.raiseWarning(`expected '<' but found '${openCharacter}'`, startRange)
            }
            let index = 0
            return {
                element: () => {
                    const ee = expectedElements[index]
                    index++
                    if (ee === undefined) {
                        this.raiseError(`found more than the expected ${expectedElements.length} element(s)`, startRange)//FIX print range properly
                        return createDummyValueHandler()

                    }
                    return ee
                },
                end: (endRange, closeCharacter, endComments) => {
                    if (closeCharacter !== ">") {
                        this.raiseWarning(`expected '>' but found '${closeCharacter}'`, endRange)
                    }
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(`elements missing`, endRange)
                    }
                    onEnd(endComments)
                },
            }
        }
    }

    public createTaggedUnionSurrogate(callback: (option: string, range: Range, optionRange: Range, comments: Comment[]) => ValueHandler): OnArray {
        return () => {
            let dataHandler: ValueHandler | null = null
            return {
                element: (startRange, _comments) => {
                    return {
                        array: (startLocation, openCharacter, dataComments) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected array`, startLocation)
                                return createDummyArrayHandler()

                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.array(startLocation, openCharacter, dataComments)
                        },
                        object: (startLocation, openCharacter, dataComments) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected object`, startLocation)
                                return createDummyObjectHandler()

                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.object(startLocation, openCharacter, dataComments)
                        },
                        boolean: (value, dataRange, dataComments) => {
                            if (dataHandler === null) {
                                return this.raiseError(`expected string`, dataRange)

                            } else {
                                dataHandler.boolean(value, dataRange, dataComments)
                            }
                        },
                        number: (value, dataRange, dataComments) => {
                            if (dataHandler === null) {
                                return this.raiseError(`expected string`, dataRange)
                            } else {
                                dataHandler.number(value, dataRange, dataComments)
                            }
                        },
                        string: (value, range, dataComments) => {
                            if (dataHandler === null) {
                                //found the option
                                dataHandler = callback(value, startRange, range, dataComments)
                            } else {
                                dataHandler.string(value, range, dataComments)
                            }
                        },
                        null: (dataRange, dataComments) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected null`, dataRange)
                                return createDummyObjectHandler()
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.null(dataRange, dataComments)
                        },
                        taggedUnion: (option, startLocation, dataRange, dataComments) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected tagged union`, startLocation)
                                return createDummyValueHandler()

                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.taggedUnion(option, startLocation, dataRange, dataComments)

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

    public createListHandler(onElement: (start: Range, comments: Comment[]) => ValueHandler): OnArray {
        return (startRange, openCharacter) => {
            if (openCharacter !== "[") {
                this.raiseWarning(`expected '[' but found '${openCharacter}'`, startRange)
            }
            return {
                element: (elementStartRange, comments) => onElement(elementStartRange, comments),
                end: (endRange, closeCharacter) => {
                    if (closeCharacter !== "]") {
                        this.raiseWarning(`expected ']' but found '${closeCharacter}'`, endRange)
                    }
                },
            }
        }
    }
    public createUnexpectedBooleanHandler(expected: string): OnBoolean {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'boolean' `, range)
    }
    public createUnexpectedNumberHandler(expected: string): OnNumber {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'number' `, range)
    }
    public createUnexpectedStringHandler(expected: string): OnString {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'string' `, range)
    }
    public createUnexpectedNullHandler(expected: string): OnNull {
        return range => this.raiseError(`expected '${expected}' but found 'null' `, range)
    }
    public createUnexpectedTaggedUnionHandler(expected: string): OnTaggedUnion {
        return (_option, location) => {
            this.raiseError(`expected '${expected}' but found 'tagged union' `, location)
            return createDummyValueHandler()
        }
    }
    public createUnexpectedObjectHandler(expected: string): OnObject {
        return startLocation => {
            this.raiseError(`expected '${expected}' but found 'object' `, startLocation)
            return createDummyObjectHandler()
        }

    }
    public createUnexpectedArrayHandler(expected: string): OnArray {
        return startLocation => {
            this.raiseError(`expected '${expected}' but found 'array' `, startLocation)
            return createDummyArrayHandler()

        }
    }

    public expectNothing(onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("nothing"),
            object: this.createUnexpectedObjectHandler("nothing"),
            boolean: this.createUnexpectedBooleanHandler("nothing"),
            number: this.createUnexpectedNumberHandler("nothing"),
            string: this.createUnexpectedStringHandler("nothing"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("nothing"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("nothing"),
        }
    }
    public expectString(callback: (value: string, range: Range, comments: Comment[]) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("string"),
            object: this.createUnexpectedObjectHandler("string"),
            boolean: this.createUnexpectedBooleanHandler("string"),
            number: this.createUnexpectedNumberHandler("string"),
            string: callback,
            null: onNull ? onNull : this.createUnexpectedNullHandler("string"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("string"),
        }
    }

    public expectNumber(callback: (value: number, range: Range, comments: Comment[]) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("number"),
            object: this.createUnexpectedObjectHandler("number"),
            boolean: this.createUnexpectedBooleanHandler("number"),
            number: callback,
            string: this.createUnexpectedStringHandler("number"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("number"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("number"),
        }
    }

    public expectBoolean(callback: (value: boolean, range: Range, comments: Comment[]) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("boolean"),
            object: this.createUnexpectedObjectHandler("boolean"),
            number: this.createUnexpectedNumberHandler("boolean"),
            string: this.createUnexpectedStringHandler("boolean"),
            boolean: callback,
            null: onNull ? onNull : this.createUnexpectedNullHandler("booelan"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("boolean"),
        }
    }

    public expectDictionary(onProperty: (key: string, range: Range, comments: Comment[]) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("dictionary"),
            object: this.createDictionaryHandler(onProperty),
            boolean: this.createUnexpectedBooleanHandler("dictionary"),
            number: this.createUnexpectedNumberHandler("dictionary"),
            string: this.createUnexpectedStringHandler("dictionary"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("dictionary"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("dictionary"),
        }
    }


    public expectType(expectedProperties: { [key: string]: ValueHandler }, onEnd: (hasErrors: boolean, comments: Comment[]) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("type"),
            object: this.createTypeHandler(expectedProperties, onEnd),
            boolean: this.createUnexpectedBooleanHandler("type"),
            number: this.createUnexpectedNumberHandler("type"),
            string: this.createUnexpectedStringHandler("type"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("type"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("type"),
        }
    }

    public expectList(onElement: (startLocation: Range, comments: Comment[]) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createListHandler(onElement),
            object: this.createUnexpectedObjectHandler("list"),
            boolean: this.createUnexpectedBooleanHandler("list"),
            number: this.createUnexpectedNumberHandler("list"),
            string: this.createUnexpectedStringHandler("list"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("list"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("list"),
        }
    }

    public expectArrayType(expectedElements: ValueHandler[], onEnd: (comments: Comment[]) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createArrayTypeHandler(expectedElements, onEnd),
            object: this.createUnexpectedObjectHandler("array type"),
            boolean: this.createUnexpectedBooleanHandler("array type"),
            number: this.createUnexpectedNumberHandler("array type"),
            string: this.createUnexpectedStringHandler("array type"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("array type"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("array type"),
        }
    }

    public expectTaggedUnion(callback: (option: string, range: Range, optionRange: Range, comments: Comment[]) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("tagged union"),
            object: this.createUnexpectedObjectHandler("tagged union"),
            boolean: this.createUnexpectedBooleanHandler("tagged union"),
            number: this.createUnexpectedNumberHandler("tagged union"),
            string: this.createUnexpectedStringHandler("tagged union"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("tagged union"),
            taggedUnion: callback,
        }
    }

    /**
     * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
     * @param callback
     */
    public expectTaggedUnionOrArraySurrogate(callback: (option: string, range: Range, optionRange: Range, comments: Comment[]) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createTaggedUnionSurrogate(callback),
            object: this.createUnexpectedObjectHandler("tagged union"),
            boolean: this.createUnexpectedBooleanHandler("tagged union"),
            number: this.createUnexpectedNumberHandler("tagged union"),
            string: this.createUnexpectedStringHandler("tagged union"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("tagged union"),
            taggedUnion: callback,
        }
    }
}
