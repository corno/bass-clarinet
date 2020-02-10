import { ValueHandler, ObjectHandler, ArrayHandler } from "./subscribeStack"
import { Location, Range, printLocation } from "./location"

function createDummyValueHandler(): ValueHandler {
    return {
        array: () => createDummyArrayHandler(),
        object: () => createDummyObjectHandler(),
        value: () => {},
        typedunion: () => createDummyValueHandler(),
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

export type ErrorHandler = (message: string, location: Location) => void

export class ErrorContext {
    private errorHandler: null | ErrorHandler
    /**
     * 
     * @param errorHandler if provided (not null), the errors are reported to this handler
     * and no errors are thrown
     * if not provided (null), this Context will throw errors
     */
    constructor(errorHandler: null | ErrorHandler) {
        this.errorHandler = errorHandler
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

    public expectText(callback: (value: string) => void): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected text but found array`, location),
            object: (location) => this.raiseObjectError(`expected text but found object`, location),
            value: (value, range) => {
                if (typeof value !== `string`) {
                    return this.raiseError(`value is not a string`, range.start)
                }
                callback(value)
            },
            typedunion: (_option, location) => this.raiseValueError(`expected text but found typed union`, location),
        }
    }

    public expectNumber(callback: (value: number) => void): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected number but found array`, location),
            object: (location) => this.raiseObjectError(`expected number but found object`, location),
            value: (value, range) => {
                if (typeof value !== `number`) {
                    return this.raiseError(`value is not a number`, range.start)
                }
                callback(value)
            },
            typedunion: (_option, location) => this.raiseValueError(`expected number but found typed union`, location),
        }
    }

    public expectBoolean(callback: (value: boolean) => void): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected boolean but found array`, location),
            object: (location) => this.raiseObjectError(`expected boolean but found object`, location),
            value: (value, range) => {
                if (typeof value !== `boolean`) {
                    return this.raiseError(`value is not a boolean`, range.start)
                }
                callback(value)
            },
            typedunion: (_option, location) => this.raiseValueError(`expected boolean but found typed union`, location),
        }
    }

    public expectObject(onProperty: (key: string, range: Range) => ValueHandler, onEnd: (start: Location, end: Location) => void): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected object but found array`, location),
            object: (startLocation) => {
                return {
                    property: onProperty,
                    end: (endLocation) => onEnd(startLocation, endLocation),
                }
            },
            value: (_value, range) => this.raiseError(`expected object but found value `, range.start),
            typedunion: (_option, location) => this.raiseValueError(`expected object but found typed union`, location),
        }
    }


    public expectCollection(onEntry: (key: string) => ValueHandler): ValueHandler {
        return this.expectObject(onEntry, () => { })
    }

    public expectMetaObject(expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void) {
        const foundProperies: Array<string> = []
        return this.expectObject(
            (key, range) => {
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
            (startLocation) => {
                Object.keys(expectedProperties).forEach(ep => {
                    if (foundProperies.indexOf(ep) === -1) {
                        this.raiseError(`missing property: '${ep}'`, startLocation)//FIX print location properly
                    }
                })
                onEnd()
            }
        )
    }

    public expectArray(onElement: (startLocation: Location) => ValueHandler, onEnd: (start: Location, end: Location) => void): ValueHandler {
        return {
            array: (startLocation) => {
                return {
                    element: () => onElement(startLocation),
                    end: (endLocation) => onEnd(startLocation, endLocation),
                }
            },
            object: (location) => this.raiseObjectError(`expected array but found object`, location),
            value: (_value, range) => this.raiseError(`expected array but found value `, range.start),
            typedunion: (_option, location) => this.raiseValueError(`expected array but found typed union`, location),
        }
    }

    public expectList(onElement: (startLocation: Location) => ValueHandler): ValueHandler {
        return this.expectArray(onElement, () => { })
    }

    public expectMetaArray(expectedElements: ValueHandler[], onEnd: () => void) {
        let index = 0
        return this.expectArray(
            arrayStartLocation => {
                const ee = expectedElements[index]
                index++
                if (ee === undefined) {
                    return this.raiseValueError(`found more than the expected ${expectedElements.length} element(s)`, arrayStartLocation)//FIX print range properly
                }
                return ee
            },
            (endLocation) => {
                const missing = expectedElements.length - index
                if (missing > 0) {
                    this.raiseError(`elements missing`, endLocation)
                }
                onEnd()
            }
        )
    }

    public expectTypedUnion(callback: (option: string) => ValueHandler): ValueHandler {
        return {
            array: (location) => this.raiseArrayError(`expected typed union but found array`, location),
            object: (location) => this.raiseObjectError(`expected typed union but found object`, location),
            value: (_value, range) => this.raiseError(`expected typed union but found value `, range.start),
            typedunion: (option) => {
                return callback(option)
            },
        }
    }

    /**
     * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
     * @param callback 
     */
    public expectTypedUnionOrArrayEquivalent(callback: (option: string) => ValueHandler): ValueHandler {
        return {
            array: () => {
                let dataHandler: ValueHandler | null = null
                return {
                    element: () => {
                        return {
                            array: (startLocation, openCharacter) => {
                                if (dataHandler === null) {
                                    return this.raiseArrayError(`unexected array`, startLocation)
                                }
                                const dh = dataHandler
                                dataHandler = null
                                return dh.array(startLocation, openCharacter)
                            },
                            object: (startLocation, openCharacter) => {
                                if (dataHandler === null) {
                                    return this.raiseObjectError(`unexected object`, startLocation)
                                }
                                const dh = dataHandler
                                dataHandler = null
                                return dh.object(startLocation, openCharacter)
                            },
                            value: (value, range) => {
                                if (dataHandler === null) {
                                    if (typeof value !== "string") {
                                        return this.raiseError(`expected string`, range.start)
                                    }
                                    dataHandler = callback(value)
                                } else {
                                    dataHandler.value(value, range)
                                }
                            },
                            typedunion: (option, startLocation, optionRange) => {
                                if (dataHandler === null) {
                                    return this.raiseValueError(`unexected typed union`, startLocation)
                                }
                                const dh = dataHandler
                                dataHandler = null
                                return dh.typedunion(option, startLocation, optionRange)

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
            value: (_value, range) => this.raiseError(`expected typed union but found value`, range.start),
            typedunion: (option) => {
                return callback(option)
            },
        }
    }

}
