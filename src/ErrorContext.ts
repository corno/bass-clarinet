import { ValueHandler, ObjectHandler, ArrayHandler, OnObject, OnArray, OnSimpleValue, OnNull, OnTypedUnion } from "./cerateStackedDataSubscriber"
import { Location, Range, printLocation } from "./location"

function createDummyValueHandler(): ValueHandler {
    return {
        array: () => createDummyArrayHandler(),
        object: () => createDummyObjectHandler(),
        simpleValue: () => { },
        null: () => { },
        typedUnion: () => createDummyValueHandler(),
    }
}

function createDummyArrayHandler(): ArrayHandler {
    return {
        element: () => createDummyValueHandler(),
        end: () => { },
    }
}

function createDummyObjectHandler(): ObjectHandler {
    return {
        property: () => createDummyValueHandler(),
        end: () => { },
    }
}

export type IssueHandler = (message: string, location: Location) => void

type NullHandler = (range: Range) => void

export class ErrorContext {
    private errorHandler: null | IssueHandler
    private warningHandler: null | IssueHandler
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

    public createCollectionHandler(onProperty: (key: string, range: Range) => ValueHandler): OnObject {
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
    
    public createMetaObjectHandler(expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void): OnObject {
        return (startLocation, openCharacter) => {
            if (openCharacter !== "(") {
                this.raiseWarning(`expected '(' but found '${openCharacter}'`, startLocation)
            }
            const foundProperies: Array<string> = []
            return {
                property: (key, range) => {
                    if (foundProperies.indexOf(key) !== -1) {
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
                        if (foundProperies.indexOf(ep) === -1) {
                            this.raiseError(`missing property: '${ep}'`, startLocation)//FIX print location properly
                        }
                    })
                    onEnd()
                }
            }
        }
    }
    
    public createMetaArrayHandler(expectedElements: ValueHandler[], onEnd: () => void): OnArray {
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

    public createTypedUnionSurrogate(callback: (option: string) => ValueHandler): OnArray {
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
                        simpleValue: (value, range, comments) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    return this.raiseError(`expected string`, range.start)
                                }
                                dataHandler = callback(value)
                            } else {
                                dataHandler.simpleValue(value, range, comments)
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
                        typedUnion: (option, startLocation, optionRange, comments) => {
                            if (dataHandler === null) {
                                return this.raiseValueError(`unexected typed union`, startLocation)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.typedUnion(option, startLocation, optionRange, comments)

                        },
                    }
                },
                end: (endLocation) => {
                    if (dataHandler === null) {
                        this.raiseError(`missing option`, endLocation)
                    }
                }
            }
        }
    }

    public createListHandler(onElement: (startLocation: Location) => ValueHandler) : OnArray {
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

    public createUnexpectedSimpleValueHandler(expected: string): OnSimpleValue {
        return (_value, range) => this.raiseError(`expected '${expected}' but found 'value' `, range.start)
    }
    public createUnexpectedNullHandler(expected: string): OnNull {
        return (range) => this.raiseError(`expected '${expected}' but found 'null' `, range.start)
    }
    public createUnexpectedTypedUnionHandler(expected: string): OnTypedUnion {
        return (_option, location) => this.raiseValueError(`expected '${expected}' but found 'typed union' `, location)
    }
    public createUnexpectedObjectHandler(expected: string): OnObject {
        return (startLocation) => this.raiseObjectError(`expected '${expected}' but found 'object' `, startLocation)
    }
    public createUnexpectedArrayHandler(expected: string): OnArray {
        return (startLocation) => this.raiseArrayError(`expected '${expected}' but found 'array' `, startLocation)
    }

    public expectString(callback: (value: string, range: Range) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("string"),
            object: this.createUnexpectedObjectHandler("string"),
            simpleValue: (value, range) => {
                if (typeof value !== `string`) {
                    return this.raiseError(`expected a string`, range.start)
                }
                callback(value, range)
            },
            null: onNull ? onNull: this.createUnexpectedNullHandler("string"),
            typedUnion: this.createUnexpectedTypedUnionHandler("string"),
        }
    }

    public expectNumber(callback: (value: number) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("number"),
            object: this.createUnexpectedObjectHandler("number"),
            simpleValue: (value, range) => {
                if (typeof value !== `number`) {
                    return this.raiseError(`expected a number`, range.start)
                }
                callback(value)
            },
            null: onNull ? onNull: this.createUnexpectedNullHandler("number"),
            typedUnion: this.createUnexpectedTypedUnionHandler("number"),
        }
    }

    public expectBoolean(callback: (value: boolean) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("boolean"),
            object: this.createUnexpectedObjectHandler("boolean"),
            simpleValue: (value, range) => {
                if (typeof value !== `boolean`) {
                    return this.raiseError(`expected a boolean`, range.start)
                }
                callback(value)
            },
            null: onNull ? onNull: this.createUnexpectedNullHandler("booelan"),
            typedUnion: this.createUnexpectedTypedUnionHandler("boolean"),
        }
    }

    public expectCollection(onProperty: (key: string, range: Range) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("collection"),
            object: this.createCollectionHandler(onProperty),
            simpleValue: this.createUnexpectedSimpleValueHandler("collection"),
            null: onNull ? onNull: this.createUnexpectedNullHandler("collection"),
            typedUnion: this.createUnexpectedTypedUnionHandler("collection"),
        }
    }


    public expectMetaObject(expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("meta object"),
            object: this.createMetaObjectHandler(expectedProperties, onEnd),
            simpleValue: this.createUnexpectedSimpleValueHandler("object"),
            null: onNull ? onNull: this.createUnexpectedNullHandler("object"),
            typedUnion: this.createUnexpectedTypedUnionHandler("object"),
        }
    }

    public expectList(onElement: (startLocation: Location) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createListHandler(onElement),
            object: this.createUnexpectedObjectHandler("list"),
            simpleValue: this.createUnexpectedSimpleValueHandler("list"),
            null: onNull ? onNull: this.createUnexpectedNullHandler("list"),
            typedUnion: this.createUnexpectedTypedUnionHandler("list"),
        }
    }

    public expectMetaArray(expectedElements: ValueHandler[], onEnd: () => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createMetaArrayHandler(expectedElements, onEnd),
            object: this.createUnexpectedObjectHandler("meta array"),
            simpleValue: this.createUnexpectedSimpleValueHandler("meta array"),
            null: onNull ? onNull: this.createUnexpectedNullHandler("meta array"),
            typedUnion: this.createUnexpectedTypedUnionHandler("meta array"),
        }
    }


    public expectMetaObjectOrMetaArray(expectedProperties: { [key: string]: ValueHandler }, expectedElements: ValueHandler[], onEnd: () => void, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createMetaArrayHandler(expectedElements, onEnd),
            object: this.createMetaObjectHandler(expectedProperties, onEnd),
            simpleValue: this.createUnexpectedSimpleValueHandler("meta object or meta array"),
            null: onNull ? onNull: this.createUnexpectedNullHandler("meta object or meta array"),
            typedUnion: this.createUnexpectedTypedUnionHandler("meta object or meta array"),
        }
    }

    public expectTypedUnion(callback: (option: string) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createUnexpectedArrayHandler("typed union"),
            object: this.createUnexpectedObjectHandler("typed union"),
            simpleValue: this.createUnexpectedSimpleValueHandler("typed union"),
            null: onNull ? onNull: this.createUnexpectedNullHandler("typed union"),
            typedUnion: (option) => callback(option)
        }
    }

    /**
     * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
     * @param callback 
     */
    public expectTypedUnionOrArraySurrogate(callback: (option: string) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: this.createTypedUnionSurrogate(callback),
            object: this.createUnexpectedObjectHandler("typed union"),
            simpleValue: this.createUnexpectedSimpleValueHandler("typed union"),
            null: onNull ? onNull : this.createUnexpectedNullHandler("typed union"),
            typedUnion: (option) => callback(option),
        }
    }
}
