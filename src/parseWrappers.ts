import { ValueHandler, ObjectHandler, ArrayHandler } from "./subscribeStack"
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

    public expectString(callback: (value: string) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected string but found array`, location),
            object: (location) => this.raiseObjectError(`expected string but found object`, location),
            simpleValue: (value, range) => {
                if (typeof value !== `string`) {
                    return this.raiseError(`value is not a string`, range.start)
                }
                callback(value)
            },
            null: onNull ? onNull : (range) => this.raiseValueError(`expected text but found null`, range.start),
            typedUnion: (_option, location) => this.raiseValueError(`expected text but found typed union`, location),
        }
    }

    public expectNumber(callback: (value: number) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected number but found array`, location),
            object: (location) => this.raiseObjectError(`expected number but found object`, location),
            simpleValue: (value, range) => {
                if (typeof value !== `number`) {
                    return this.raiseError(`value is not a number`, range.start)
                }
                callback(value)
            },
            null: onNull ? onNull : (range) => this.raiseValueError(`expected number but found null`, range.start),
            typedUnion: (_option, location) => this.raiseValueError(`expected number but found typed union`, location),
        }
    }

    public expectBoolean(callback: (value: boolean) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected boolean but found array`, location),
            object: (location) => this.raiseObjectError(`expected boolean but found object`, location),
            simpleValue: (value, range) => {
                if (typeof value !== `boolean`) {
                    return this.raiseError(`value is not a boolean`, range.start)
                }
                callback(value)
            },
            null: onNull ? onNull : (range) => this.raiseValueError(`expected boolean but found null`, range.start),
            typedUnion: (_option, location) => this.raiseValueError(`expected boolean but found typed union`, location),
        }
    }

    public expectCollection(onProperty: (key: string, range: Range) => ValueHandler, onEnd: (start: Location, end: Location) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected collection but found array`, location),
            object: (startLocation, openCharacter) => {
                if (openCharacter !== "{") {
                    this.raiseWarning(`expected '<' but found '${openCharacter}'`, startLocation)
                }
                return {
                    property: onProperty,
                    end: (endLocation, closeCharacter) => {
                        if (closeCharacter !== "}") {
                            this.raiseWarning(`expected '}' but found '${closeCharacter}'`, endLocation)
                        }
                        onEnd(startLocation, endLocation)
                    },
                }
            },
            simpleValue: (_value, range) => this.raiseError(`expected collection but found value `, range.start),
            null: onNull ? onNull : (range) => this.raiseValueError(`expected collection but found null`, range.start),
            typedUnion: (_option, location) => this.raiseValueError(`expected collection but found typed union`, location),
        }
    }

    private createMetaObjectHandler(startLocation: Location, openCharacter: string, expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void): ObjectHandler {
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

    public expectMetaObject(expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void, onNull?: NullHandler): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected object but found array`, location),
            object: (startLocation, openCharacter) => {
                return this.createMetaObjectHandler(startLocation, openCharacter, expectedProperties, onEnd)
            },
            simpleValue: (_value, range) => this.raiseError(`expected object but found value `, range.start),
            null: onNull ? onNull : (range) => this.raiseValueError(`expected object but found null`, range.start),
            typedUnion: (_option, location) => this.raiseValueError(`expected object but found typed union`, location),
        }
    }

    public expectList(onElement: (startLocation: Location) => ValueHandler, onEnd: (start: Location, end: Location) => void, onNull?: NullHandler): ValueHandler {
        return {
            array: (startLocation, openCharacter) => {
                if (openCharacter !== "[") {
                    this.raiseWarning(`expected '[' but found '${openCharacter}'`, startLocation)
                }
                return {
                    element: () => onElement(startLocation),
                    end: (endLocation, closeCharacter) => {
                        if (closeCharacter !== "]") {
                            this.raiseWarning(`expected ']' but found '${closeCharacter}'`, endLocation)
                        }
                        onEnd(startLocation, endLocation)
                    },
                }
            },
            object: (location) => this.raiseObjectError(`expected list but found object`, location),
            simpleValue: (_value, range) => this.raiseError(`expected list but found value `, range.start),
            null: onNull ? onNull : (range) => this.raiseValueError(`expected list but found null`, range.start),
            typedUnion: (_option, location) => this.raiseValueError(`expected list but found typed union`, location),
        }
    }

    private createMetaArrayHandler(arrayStartLocation: Location, openCharacter: string, expectedElements: ValueHandler[], onEnd: () => void): ArrayHandler {
        if (openCharacter !== "<") {
            this.raiseWarning(`expected '<' but found '${openCharacter}'`, arrayStartLocation)
        }
        let index = 0
        return {
            element: () => {
                const ee = expectedElements[index]
                index++
                if (ee === undefined) {
                    return this.raiseValueError(`found more than the expected ${expectedElements.length} element(s)`, arrayStartLocation)//FIX print range properly
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

    public expectMetaArray(expectedElements: ValueHandler[], onEnd: () => void, onNull: NullHandler): ValueHandler {
        return {
            array: (startLocation, openCharacter) => {
                return this.createMetaArrayHandler(startLocation, openCharacter, expectedElements, onEnd)
            },
            object: (location) => this.raiseObjectError(`expected meta array but found object`, location),
            simpleValue: (_value, range) => this.raiseError(`expected meta array but found value `, range.start),
            null: onNull ? onNull : (range) => this.raiseValueError(`expected meta array but found null`, range.start),
            typedUnion: (_option, location) => this.raiseValueError(`expected meta array but found typed union`, location),
        }
    }


    public expectMetaObjectOrMetaArray(expectedProperties: { [key: string]: ValueHandler }, expectedElements: ValueHandler[], onEnd: () => void, onNull?: NullHandler): ValueHandler {
        return {
            array: (startLocation, openCharacter) => {
                return this.createMetaArrayHandler(startLocation, openCharacter, expectedElements, onEnd)
            },
            object: (startLocation, openCharacter) => {
                return this.createMetaObjectHandler(startLocation, openCharacter, expectedProperties, onEnd)
            },
            simpleValue: (_value, range) => this.raiseError(`expected meta object or meta array but found value `, range.start),
            null: onNull ? onNull : (range) => this.raiseValueError(`expected meta object or meta array but found null`, range.start),
            typedUnion: (_option, location) => this.raiseValueError(`expected meta object or meta array but found typed union`, location),
        }
    }

    public expectTypedUnion(callback: (option: string) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected typed union but found array`, location),
            object: (location) => this.raiseObjectError(`expected typed union but found object`, location),
            simpleValue: (_value, range) => this.raiseError(`expected typed union but found value `, range.start),
            null: onNull ? onNull : (range) => this.raiseValueError(`expected type union but found null`, range.start),
            typedUnion: (option) => {
                return callback(option)
            },
        }
    }

    /**
     * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
     * @param callback 
     */
    public expectTypedUnionOrArrayEquivalent(callback: (option: string) => ValueHandler, onNull?: NullHandler): ValueHandler {
        return {
            array: () => {
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
            },
            object: (location) => this.raiseObjectError(`expected typed union but found object`, location),
            simpleValue: (_value, range) => this.raiseError(`expected typed union but found value`, range.start),
            null: onNull ? onNull : (range) => this.raiseError(`expected typed union but found null`, range.start),
            typedUnion: (option) => {
                return callback(option)
            },
        }
    }
}
