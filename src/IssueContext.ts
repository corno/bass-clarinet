/* eslint
    max-classes-per-file: "off",
*/
import {
    ValueHandler,
    OnObject,
    OnArray,
    OnBoolean,
    OnNumber,
    OnString,
    OnNull,
    OnTaggedUnion,
} from "./createStackedDataSubscriber"
import { Range } from "./location"
import { RangeError } from "./errors"
import { createDummyObjectHandler, createDummyArrayHandler, createDummyValueHandler } from "./dummyHandlers"

export type IssueHandler = (message: string, range: Range) => void

type NullHandler = (range: Range) => void

export class IssueContext {
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

    public createDictionaryHandler(onProperty: (key: string, range: Range) => ValueHandler): OnObject {
        return (start, openCharacter) => {
            if (openCharacter !== "{") {
                this.raiseWarning(`expected '{' but found '${openCharacter}'`, start)
            }
            const foundEntries: string[] = []
            return {
                property: (key, range) => {
                    if (foundEntries.includes(key)) {
                        this.raiseWarning(`duplicate key '${key}'`, range)
                    }
                    foundEntries.push(key)
                    return onProperty(key, range)
                },
                end: (endRange, closeCharacter) => {
                    if (closeCharacter !== "}") {
                        this.raiseWarning(`expected '}' but found '${closeCharacter}'`, endRange)
                    }
                },
            }
        }
    }

    public createTypeHandler(expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void): OnObject {
        return (startRange, openCharacter) => {
            if (openCharacter !== "(") {
                this.raiseWarning(`expected '(' but found '${openCharacter}'`, startRange)
            }
            const foundProperies: string[] = []
            return {
                property: (key, range) => {
                    if (foundProperies.includes(key)) {
                        this.raiseError(`property already processed: '${key}'`, range)//FIX print range properly
                        return createDummyValueHandler()
                    }
                    foundProperies.push(key)
                    const expected = expectedProperties[key]
                    if (expected === undefined) {
                        this.raiseError(`unexpected property: '${key}'`, range)//FIX print range properly
                        return createDummyValueHandler()
                    }
                    return expected
                },
                end: (endRange, closeCharacter) => {

                    if (closeCharacter !== ")") {
                        this.raiseWarning(`expected ')' but found '${closeCharacter}'`, endRange)
                    }
                    Object.keys(expectedProperties).forEach(ep => {
                        if (!foundProperies.includes(ep)) {
                            this.raiseError(`missing property: '${ep}'`, startRange)//FIX print location properly
                        }
                    })
                    onEnd()
                },
            }
        }
    }

    public createArrayTypeHandler(expectedElements: ValueHandler[], onEnd: () => void): OnArray {
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
                end: (endRange, closeCharacter) => {
                    if (closeCharacter !== ">") {
                        this.raiseWarning(`expected '>' but found '${closeCharacter}'`, endRange)
                    }
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(`elements missing`, endRange)
                    }
                    onEnd()
                },
            }
        }
    }

    public createTaggedUnionSurrogate(callback: (option: string, range: Range) => ValueHandler): OnArray {
        return () => {
            let dataHandler: ValueHandler | null = null
            return {
                element: () => {
                    return {
                        array: (startLocation, openCharacter, comments) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected array`, startLocation)
                                return createDummyArrayHandler()

                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.array(startLocation, openCharacter, comments)
                        },
                        object: (startLocation, openCharacter, comments) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected object`, startLocation)
                                return createDummyObjectHandler()

                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.object(startLocation, openCharacter, comments)
                        },
                        boolean: (value, range, comments) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    return this.raiseError(`expected string`, range)
                                }
                                dataHandler = callback(value, range)
                            } else {
                                dataHandler.boolean(value, range, comments)
                            }
                        },
                        number: (value, range, comments) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    return this.raiseError(`expected string`, range)
                                }
                                dataHandler = callback(value, range)
                            } else {
                                dataHandler.number(value, range, comments)
                            }
                        },
                        string: (value, range, comments) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    return this.raiseError(`expected string`, range)
                                }
                                dataHandler = callback(value, range)
                            } else {
                                dataHandler.string(value, range, comments)
                            }
                        },
                        null: (range, comments) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected null`, range)
                                return createDummyObjectHandler()

                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.null(range, comments)
                        },
                        taggedUnion: (option, startLocation, optionRange, comments) => {
                            if (dataHandler === null) {
                                this.raiseError(`unexected tagged union`, startLocation)
                                return createDummyValueHandler()

                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.taggedUnion(option, startLocation, optionRange, comments)

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

    public createListHandler(onElement: (start: Range) => ValueHandler): OnArray {
        return (startRange, openCharacter) => {
            if (openCharacter !== "[") {
                this.raiseWarning(`expected '[' but found '${openCharacter}'`, startRange)
            }
            return {
                element: () => onElement(startRange),
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

    public expectString(callback: (value: string, range: Range) => void, onNull?: NullHandler): ValueHandler {
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

    public expectNumber(callback: (value: number, range: Range) => void, onNull?: NullHandler): ValueHandler {
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

    public expectBoolean(callback: (value: boolean, range: Range) => void, onNull?: NullHandler): ValueHandler {
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

    public expectDictionary(onProperty: (key: string, range: Range) => ValueHandler, onNull?: NullHandler): ValueHandler {
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


    public expectType(expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void, onNull?: NullHandler): ValueHandler {
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

    public expectList(onElement: (startLocation: Range) => ValueHandler, onNull?: NullHandler): ValueHandler {
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

    public expectArrayType(expectedElements: ValueHandler[], onEnd: () => void, onNull?: NullHandler): ValueHandler {
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

    public expectTaggedUnion(callback: (option: string, range: Range) => ValueHandler, onNull?: NullHandler): ValueHandler {
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
    public expectTaggedUnionOrArraySurrogate(callback: (option: string, range: Range) => ValueHandler, onNull?: NullHandler): ValueHandler {
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
