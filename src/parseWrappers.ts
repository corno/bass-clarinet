import { ValueHandler } from "./subscribeStack"
import { Location, Range } from "./parserTypes"


function printLocation(location: Location) {
    return `${location.line}:${location.column}`
}
function printRange(range: Range) {
    return `${range.start.line}:${range.start.column}-${range.start.line === range.end.line ? "" : range.end.line + ":"}${range.end.column}`
}

export function expectObject(onProperty: (key: string, range: Range) => ValueHandler, onEnd: (start: Location, end: Location) => void): ValueHandler {
    return {
        array: (location) => { throw new Error(`unexpected array  @ ${printLocation(location)}`) },
        object: (startLocation) => {
            return {
                property: onProperty,
                end: (endLocation) => onEnd(startLocation, endLocation),
            }
        },
        value: (_value, range) => { throw new Error(`unexpected value  @ ${printRange(range)}`) },
        typedunion: (_option, location) => { throw new Error(`unexpected typed union  @ ${printLocation(location)}`) },
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

export function expectText(callback: (value: string) => void): ValueHandler {
    return {
        array: (location) => { throw new Error(`unexpected array  @ ${printLocation(location)}`) },
        object: (location) => { throw new Error(`unexpected object @ ${printLocation(location)}`) },
        value: (value, range) => {
            if (typeof value !== `string`) {
                throw new Error(`value is not a string @ ${printRange(range)}`)
            }
            callback(value)
        },
        typedunion: (_option, location) => { throw new Error(`unexpected typed union @ ${printLocation(location)}`) },
    }
}

export function expectNumber(callback: (value: number) => void): ValueHandler {
    return {
        array: (location) => { throw new Error(`unexpected array  @ ${printLocation(location)}`) },
        object: (location) => { throw new Error(`unexpected object @ ${printLocation(location)}`) },
        value: (value, range) => {
            if (typeof value !== `number`) {
                throw new Error(`value is not a number @ ${printRange(range)}`)
            }
            callback(value)
        },
        typedunion: (_option, location) => { throw new Error(`unexpected typed union @ ${printLocation(location)}`) },
    }
}

export function expectBoolean(callback: (value: boolean) => void): ValueHandler {
    return {
        array: (location) => { throw new Error(`unexpected array  @ ${printLocation(location)}`) },
        object: (location) => { throw new Error(`unexpected object @ ${printLocation(location)}`) },
        value: (value, range) => {
            if (typeof value !== `boolean`) {
                throw new Error(`value is not a boolean @ ${printRange(range)}`)
            }
            callback(value)
        },
        typedunion: (_option, location) => { throw new Error(`unexpected typed union @ ${printLocation(location)}`) },
    }
}

export function expectTypedUnion(callback: (option: string) => ValueHandler): ValueHandler {
    return {
        array: (location) => { throw new Error(`unexpected array  @ ${printLocation(location)}`) },
        object: (location) => { throw new Error(`unexpected object @ ${printLocation(location)}`) },
        value: (_value, range) => { throw new Error(`unexpected value  @ ${printRange(range)}`) },
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
                                throw new Error(`unexected array @ ...`)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.array(startLocation, openCharacter)
                        },
                        object: (startLocation, openCharacter) => { 
                            if (dataHandler === null) {
                                throw new Error(`unexected object @ ...`)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.object(startLocation, openCharacter)
                         },
                        value: (value, range) => {
                            if (dataHandler === null) {
                                if (typeof value !== "string") {
                                    throw new Error(`expected string @ ...`)
                                }
                                dataHandler = callback(value)
                            } else {
                                dataHandler.value(value, range)
                            }
                        },
                        typedunion: (option, startLocation, optionRange) => {
                            if (dataHandler === null) {
                                throw new Error(`unexected typed union @ ...`)
                            }
                            const dh = dataHandler
                            dataHandler = null
                            return dh.typedunion(option, startLocation, optionRange)
                            
                        },
                    }
                },
                end: () => {
                    if (dataHandler === null) {
                        throw new Error(`missing option @ ...`)
                    }
                }
            }
        },
        object: (_location) => { throw new Error(`unexpected object @ ...`) },
        value: (_value, _range) => { throw new Error(`unexpected value  ...`) },
        typedunion: (option) => {
            return callback(option)
        },
    }
}
