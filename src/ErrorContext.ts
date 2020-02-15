import {
    ValueHandler,
    ObjectHandler,
    ArrayHandler,
    OnObject,
    OnArray,
    OnBoolean,
    OnNumber,
    OnString,
    OnNull,
    OnTaggedUnion,
} from "./cerateStackedDataSubscriber"
import { Location, Range, printLocation } from "./location"

function createDummyValueHandler(): ValueHandler {
    return {
        array: () => createDummyArrayHandler(),
        object: () => createDummyObjectHandler(),
        boolean: () => {
            //do nothing
        },
        number: () => {
            //do nothing
        },
        string: () => {
            //do nothing
        },
        null: () => {
            //do nothing
        },
        taggedUnion: () => createDummyValueHandler(),
    }
}

function createDummyArrayHandler(): ArrayHandler {
    return {
        element: () => createDummyValueHandler(),
        end: () => {
            //do nothing
        },
    }
}

function createDummyObjectHandler(): ObjectHandler {
    return {
        property: () => createDummyValueHandler(),
        end: () => {
            //do nothing
        },
    }
}

export type IssueHandler = (message: string, location: Location) => void

type NullHandler = (range: Range) => void

export class ErrorContext {
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
    public raiseWarning(message: string, location: Location) {
        if (this.warningHandler === null) {
            throw new Error(message + ` @ ${printLocation(location)}`)
        }
    }
    public raiseObjectError(message: string, location: Location): ObjectHandler {
        if (this.errorHandler === null) {
            throw new Error(message + ` @ ${printLocation(location)}`)
        }
        this.errorHandler(message, location)
        return createDummyObjectHandler()
    }
    public raiseArrayError(message: string, location: Location): ArrayHandler {
        if (this.errorHandler === null) {
            throw new Error(message + ` @ ${printLocation(location)}`)
        }
        this.errorHandler(message, location)
        return createDummyArrayHandler()
    }
    public raiseValueError(message: string, location: Location): ValueHandler {
        if (this.errorHandler === null) {
            throw new Error(message + ` @ ${printLocation(location)}`)
        }
        this.errorHandler(message, location)
        return createDummyValueHandler()
    }
    public raiseError(message: string, location: Location): void {
        if (this.errorHandler === null) {
            throw new Error(message + ` @ ${printLocation(location)}`)
        }
        this.errorHandler(message, location)
    }

    public createDictionaryHandler(onProperty: (key: string, range: Range) => ValueHandler): OnObject {
        return (startLocation, openCharacter) => {
            if (openCharacter !== "{") {
                this.raiseWarning(`expected '<' but found '${openCharacter}'`, startLocation)
            }
            return {
                property: onProperty,
                end: (endLocation, closeCharacter) => {
                    if (closeCharacter !== "}") {
                        this.raiseWarning(`expected '}' but found '${closeCharacter}'`, endLocation)
                    }
                },
            }
        }
    }

    public createTypeHandler(expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void): OnObject {
        return (startLocation, openCharacter) => {
            if (openCharacter !== "(") {
                this.raiseWarning(`expected '(' but found '${openCharacter}'`, startLocation)
            }
            const foundProperies: string[] = []
            return {
                property: (key, range) => {
                    if (foundProperies.includes(key)) {
                        return this.raiseValueError(`property already processed: '${key}'`, range.start)//FIX print range properly
                    }
                    foundProperies.push(key)
                    const expected = expectedProperties[key]
                    if (expected === undefined) {
                        return this.raiseValueError(`unexpected property: '${key}'`, range.start)//FIX print range properly
                    }
                    return expected
                },
                end: (endLocation, closeCharacter) => {

                    if (closeCharacter !== ")") {
                        this.raiseWarning(`expected '<' but found '${closeCharacter}'`, endLocation)
                    }
                    Object.keys(expectedProperties).forEach(ep => {
                        if (!foundProperies.includes(ep)) {
                            this.raiseError(`missing property: '${ep}'`, startLocation)//FIX print location properly
                        }
                    })
                    onEnd()
                },
            }
        }
    }

    public createArrayTypeHandler(expectedElements: ValueHandler[], onEnd: () => void): OnArray {
        return (startLocation, openCharacter) => {
            if (openCharacter !== "<") {
                this.raiseWarning(`expected '<' but found '${openCharacter}'`, startLocation)
            }
            let index = 0
            return {
                element: () => {
                    const ee = expectedElements[index]
                    index++
                    if (ee === undefined) {
                        return this.raiseValueError(`found more than the expected ${expectedElements.length} element(s)`, startLocation)//FIX print range properly
                    }
                    return ee
                },
                end: (endLocation, closeCharacter) => {
                    if (closeCharacter !== ">") {
                        this.raiseWarning(`expected '>' but found '${closeCharacter}'`, endLocation)
                    }
                    const missing = expectedElements.length - index
                    if (missing > 0) {
                        this.raiseError(`elements missing`, endLocation)
                    }
                    onEnd()
                },
            }
        }
    }

    public createTaggedUnionSurrogate(callback: (option: string) => ValueHandler): OnArray {
        return () => {
            let dataHandler: ValueHandler | null = null
            return {
                element: () => {
                    return {
                        array: (startLocation, openCharacter, comments) => {
                            if (dataHandler === null) {
                                return this.raiseArrayError(`unexected array`, startLocation)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.array(startLocation, openCharacter, comments)
                        },
                        object: (startLocation, openCharacter, comments) => {
                            if (dataHandler === null) {
                                return this.raiseObjectError(`unexected object`, startLocation)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.object(startLocation, openCharacter, comments)
                        },
                        boolean: (value, range, comments) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    return this.raiseError(`expected string`, range.start)
                                }
                                dataHandler = callback(value)
                            } else {
                                dataHandler.boolean(value, range, comments)
                            }
                        },
                        number: (value, range, comments) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    return this.raiseError(`expected string`, range.start)
                                }
                                dataHandler = callback(value)
                            } else {
                                dataHandler.number(value, range, comments)
                            }
                        },
                        string: (value, range, comments) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    return this.raiseError(`expected string`, range.start)
                                }
                                dataHandler = callback(value)
                            } else {
                                dataHandler.string(value, range, comments)
                            }
                        },
                        null: (range, comments) => {
                            if (dataHandler === null) {
                                return this.raiseObjectError(`unexected null`, range.start)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.null(range, comments)
                        },
                        taggedUnion: (option, startLocation, optionRange, comments) => {
                            if (dataHandler === null) {
                                return this.raiseValueError(`unexected tagged union`, startLocation)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.taggedUnion(option, startLocation, optionRange, comments)

                        },
                    }
                },
                end: endLocation => {
                    if (dataHandler === null) {
                        this.raiseError(`missing option`, endLocation)
                    }
                },
            }
        }
    }

    public createListHandler(onElement: (startLocation: Location) => ValueHandler): OnArray {
        return (startLocation, openCharacter) => {
            if (openCharacter !== "[") {
                this.raiseWarning(`expected '[' but found '${openCharacter}'`, startLocation)
            }
            return {
                element: () => onElement(startLocation),
                end: (endLocation, closeCharacter) => {
                    if (closeCharacter !== "]") {
                        this.raiseWarning(`expected ']' but found '${closeCharacter}'`, endLocation)
                    }
                },
            }
        }
    }
    public createUnexpectedBooleanHandler(expected: string): OnBoolean {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'boolean' `, range.start)
    }
    public createUnexpectedNumberHandler(expected: string): OnNumber {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'number' `, range.start)
    }
    public createUnexpectedStringHandler(expected: string): OnString {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'string' `, range.start)
    }
    public createUnexpectedNullHandler(expected: string): OnNull {
        return range => this.raiseError(`expected '${expected}' but found 'null' `, range.start)
    }
    public createUnexpectedTaggedUnionHandler(expected: string): OnTaggedUnion {
        return (_option, location) => this.raiseValueError(`expected '${expected}' but found 'tagged union' `, location)
    }
    public createUnexpectedObjectHandler(expected: string): OnObject {
        return startLocation => this.raiseObjectError(`expected '${expected}' but found 'object' `, startLocation)
    }
    public createUnexpectedArrayHandler(expected: string): OnArray {
        return startLocation => this.raiseArrayError(`expected '${expected}' but found 'array' `, startLocation)
    }

    public expectString(callback: (value: string, range: Range) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("string"),
            object: this.createUnexpectedObjectHandler("string"),
            boolean: this.createUnexpectedBooleanHandler("string"),
            number: this.createUnexpectedNumberHandler("string"),
            string: (value, range) => {
                callback(value, range)
            },
            null: onNull ? onNull : this.createUnexpectedNullHandler("string"),
            taggedUnion: this.createUnexpectedTaggedUnionHandler("string"),
        }
    }

    public expectNumber(callback: (value: number, range: Range) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("number"),
            object: this.createUnexpectedObjectHandler("number"),
            boolean: this.createUnexpectedBooleanHandler("number"),
            number: (value, range) => {
                callback(value, range)
            },
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
            boolean: (value, range) => {
                callback(value, range)
            },
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

    public expectList(onElement: (startLocation: Location) => ValueHandler, onNull?: NullHandler): ValueHandler {
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

    public expectTaggedUnion(callback: (option: string) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("tagged union"),
            object: this.createUnexpectedObjectHandler("tagged union"),
            boolean: this.createUnexpectedBooleanHandler("tagged union"),
            number: this.createUnexpectedNumberHandler("tagged union"),
            string: this.createUnexpectedStringHandler("tagged union"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("tagged union"),
            taggedUnion: option => callback(option),
        }
    }

    /**
     * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
     * @param callback
     */
    public expectTaggedUnionOrArraySurrogate(callback: (option: string) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createTaggedUnionSurrogate(callback),
            object: this.createUnexpectedObjectHandler("tagged union"),
            boolean: this.createUnexpectedBooleanHandler("tagged union"),
            number: this.createUnexpectedNumberHandler("tagged union"),
            string: this.createUnexpectedStringHandler("tagged union"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("tagged union"),
            taggedUnion: option => callback(option),
        }
    }
}
