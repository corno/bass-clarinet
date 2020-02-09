import { ValueHandler } from "./subscribeStack"
import { Location, Range } from "./parserTypes"


function printLocation(location: Location) {
    return `${location.line}:${location.column}`
}
function printRange(range: Range) {
    return `${range.start.line}:${range.start.column}-${range.start.line === range.end.line ? "" : range.end.line + ":"}${range.end.column}`
}


export function expectText(callback: (value: string) => void): ValueHandler {
    return {
        array: (location) => { throw new Error(`expected text but found array  @ ${printLocation(location)}`) },
        object: (location) => { throw new Error(`expected text but found object @ ${printLocation(location)}`) },
        value: (value, range) => {
            if (typeof value !== `string`) {
                throw new Error(`value is not a string @ ${printRange(range)}`)
            }
            callback(value)
        },
        typedunion: (_option, location) => { throw new Error(`expected text but found typed union @ ${printLocation(location)}`) },
    }
}

export function expectNumber(callback: (value: number) => void): ValueHandler {
    return {
        array: (location) => { throw new Error(`expected number but found array  @ ${printLocation(location)}`) },
        object: (location) => { throw new Error(`expected number but found object @ ${printLocation(location)}`) },
        value: (value, range) => {
            if (typeof value !== `number`) {
                throw new Error(`value is not a number @ ${printRange(range)}`)
            }
            callback(value)
        },
        typedunion: (_option, location) => { throw new Error(`expected number but found typed union @ ${printLocation(location)}`) },
    }
}

export function expectBoolean(callback: (value: boolean) => void): ValueHandler {
    return {
        array: (location) => { throw new Error(`expected boolean but found array  @ ${printLocation(location)}`) },
        object: (location) => { throw new Error(`expected boolean but found object @ ${printLocation(location)}`) },
        value: (value, range) => {
            if (typeof value !== `boolean`) {
                throw new Error(`value is not a boolean @ ${printRange(range)}`)
            }
            callback(value)
        },
        typedunion: (_option, location) => { throw new Error(`expected boolean but found typed union @ ${printLocation(location)}`) },
    }
}

export function expectObject(onProperty: (key: string, range: Range) => ValueHandler, onEnd: (start: Location, end: Location) => void): ValueHandler {
    return {
        array: (location) => { throw new Error(`expected object but found array  @ ${printLocation(location)}`) },
        object: (startLocation) => {
            return {
                property: onProperty,
                end: (endLocation) => onEnd(startLocation, endLocation),
            }
        },
        value: (_value, range) => { throw new Error(`expected object but found value  @ ${printRange(range)}`) },
        typedunion: (_option, location) => { throw new Error(`expected object but found typed union  @ ${printLocation(location)}`) },
    }
}


export function expectCollection(onEntry: (key: string) => ValueHandler): ValueHandler {
    return expectObject(onEntry, () => { })
}

export function expectMetaObject(expectedProperties: { [key: string]: ValueHandler }, onEnd: () => void) {
    const foundProperies: Array<string> = []
    return expectObject(
        (key, range) => {
            if (foundProperies.indexOf(key) !== -1) {
                throw new Error(`property already processed: '${key}' @ ${printRange(range)}`)//FIX print range properly
            }
            foundProperies.push(key)
            const expected = expectedProperties[key]
            if (expected === undefined) {
                throw new Error(`unexpected property: '${key}' @ ${printRange(range)}`)//FIX print range properly
            }
            return expected
        },
        (startLocation) => {
            Object.keys(expectedProperties).forEach(ep => {
                if (foundProperies.indexOf(ep) === -1) {
                    throw new Error(`missing property: '${ep}' @ ${printLocation(startLocation)}`)//FIX print location properly
                }
            })
            onEnd()
        }
    )
}

export function expectArray(onElement: (startLocation: Location) => ValueHandler, onEnd: (start: Location, end: Location) => void): ValueHandler {
    return {
        array: (startLocation) => {
            return {
                element: () => onElement(startLocation),
                end: (endLocation) => onEnd(startLocation, endLocation),
            }
        },
        object: (location) => { throw new Error(`expected array but found object  @ ${printLocation(location)}`) },
        value: (_value, range) => { throw new Error(`expected array but found value  @ ${printRange(range)}`) },
        typedunion: (_option, location) => { throw new Error(`expected array but found typed union  @ ${printLocation(location)}`) },
    }
}

export function expectList(onElement: (startLocation: Location) => ValueHandler): ValueHandler {
    return expectArray(onElement, () => {})
}

export function expectMetaArray(expectedElements: ValueHandler[], onEnd: () => void) {
    let index = 0
    return expectArray(
        arrayStartLocation => {
            const ee = expectedElements[index]
            index++
            if (ee === undefined) {
                throw new Error(`found more than the expected ${expectedElements.length} element(s): @ ${printLocation(arrayStartLocation)}`)//FIX print range properly
            }
            return ee
        },
        (endLocation) => {
            const missing = expectedElements.length - index
            if (missing > 0 ) {
                throw new Error(`elements missing @ ${printLocation(endLocation)}`)
            }
            onEnd()
        }
    )
}

export function expectTypedUnion(callback: (option: string) => ValueHandler): ValueHandler {
    return {
        array: (location) => { throw new Error(`expected typed union but found array  @ ${printLocation(location)}`) },
        object: (location) => { throw new Error(`expected typed union but found object @ ${printLocation(location)}`) },
        value: (_value, range) => { throw new Error(`expected typed union but found value  @ ${printRange(range)}`) },
        typedunion: (option) => {
            return callback(option)
        },
    }
}

/**
 * this parses values in the form of `| "option" <data value>` or `[ "option", <data value> ]`
 * @param callback 
 */
export function expectTypedUnionOrArrayEquivalent(callback: (option: string) => ValueHandler): ValueHandler {
    return {
        array: () => {
            let dataHandler: ValueHandler | null = null
            return {
                element: () => {
                    return {
                        array: (startLocation, openCharacter) => {
                            if (dataHandler === null) {
                                throw new Error(`unexected array @ ${printLocation(startLocation)}`)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.array(startLocation, openCharacter)
                        },
                        object: (startLocation, openCharacter) => { 
                            if (dataHandler === null) {
                                throw new Error(`unexected object @ ${printLocation(startLocation)}`)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.object(startLocation, openCharacter)
                         },
                        value: (value, range) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    throw new Error(`expected string @ ${printRange(range)}`)
                                }
                                dataHandler = callback(value)
                            } else {
                                dataHandler.value(value, range)
                            }
                        },
                        typedunion: (option, startLocation, optionRange) => {
                            if (dataHandler === null) {
                                throw new Error(`unexected typed union @ ${printLocation(startLocation)}`)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.typedunion(option, startLocation, optionRange)
                            
                        },
                    }
                },
                end: (endLocation) => {
                    if (dataHandler === null) {
                        throw new Error(`missing option @ ${printLocation(endLocation)}`)
                    }
                }
            }
        },
        object: (_location) => { throw new Error(`expected typed union but found object @ ...`) },
        value: (_value, _range) => { throw new Error(`expected typed union but found value  ...`) },
        typedunion: (option) => {
            return callback(option)
        },
    }
}
