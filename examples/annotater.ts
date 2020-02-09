import * as sp from "../src/subscribeStack"
import { Location, Range } from "../src/location"


function printLoc(location: Location) {
    return `${location.line}:${location.column}`
}
function printRange(range: Range) {
    return `${range.start.line}:${range.start.column}-${range.start.line === range.end.line ? "" : range.end.line + ":"}${range.end.column}`
}

function format(value: number | string | boolean | null) {
    if (typeof value === "string") {
        return `"${JSON.stringify(value)}"`
    } else {
        return value
    }
}

export function createValuesAnnotater(indentation: string, callback: (str: string) => void): sp.ValueHandler {
    return {
        array: (startLocation) => {
            callback(`${indentation}[ // ${printLoc(startLocation)}`)
            return {
                element: () => createValuesAnnotater(`${indentation}\t`, callback),
                end: (end => {
                    callback(`${indentation}] // ${printLoc(end)}`)
                })
            }
        },
        object: (startLocation) => {
            callback(`${indentation}{ // ${printLoc(startLocation)}`)
            return {
                property: (key, _keyRange) => {
                    callback(`${indentation}"${key}": `)
                    return createValuesAnnotater(`${indentation}\t`, callback)
                },
                end: (end) => {
                    callback(`${indentation}} // ${printLoc(end)}`)
                },
            }
        },
        value: (value, range) => {
            callback(`${indentation}${format(value)} // ${printRange(range)}`)
        },
        typedunion: (option, startLocation, range) => {
            callback(`| ${indentation}"${JSON.stringify(option)}" // ${printLoc(startLocation)} ${printRange(range)}`)
            return createValuesAnnotater(`${indentation}\t`, callback)
        },
    }
}