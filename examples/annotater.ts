import * as sp from "../src/subscribeStack"
import { Location, Range } from "../src/Parser"


function printLoc(location: Location) {
    return `${location.line}:${location.column}`
}
function printRange(range: Range) {
    return `${range.start.line}:${range.start.column}-${range.start.line === range.end.line ? "" : range.end.line + ":"}${range.end.column}`
}

function format(value: number | string | boolean | null) {
    if (typeof value === "string") {
        return `"${value}"`
    } else {
        return value
    }
}

export function createPropertiesAnnotater(indentation: string, callback: (str: string) => void): sp.PropertySubscribers {
    return {
        array: (key, ac, keyRange) => {
            callback(`${indentation}"${key}": [ // ${printRange(keyRange)} ${printLoc(ac.start)}`)
            ac.onElement(createValuesAnnotater(`${indentation}\t`, callback, false))
            ac.onEnd(end => {
                callback(`${indentation}], // "${key}" ${printLoc(end)}`)
            })
        },
        object: (key, oc, keyRange) => {
            callback(`${indentation}"${key}": { // ${printRange(keyRange)} ${printLoc(oc.start)}`)
            oc.onProperty(createPropertiesAnnotater(`${indentation}\t`, callback))
            oc.onEnd(end => {
                callback(`${indentation}}, // "${key}" ${printLoc(end)}`)
            })
        },
        value: (key, value, range, keyRange) => {
            callback(`${indentation}"${key}": ${format(value)}, //${printRange(keyRange)} ${printRange(range)}`)
        },
    }
}

export function createValuesAnnotater(indentation: string, callback: (str: string) => void, isRoot: boolean): sp.ValueSubscribers {
    const suffix = isRoot ? "" : ","
    return {
        array: (ac) => {
            callback(`${indentation}[ // ${printLoc(ac.start)}`)
            ac.onElement(createValuesAnnotater(`${indentation}\t`, callback, false))
            ac.onEnd(end => {
                callback(`${indentation}]${suffix} // ${printLoc(end)}`)
            })
        },
        object: (oc) => {
            callback(`${indentation}{ // ${printLoc(oc.start)}`)
            oc.onProperty(createPropertiesAnnotater(`${indentation}\t`, callback))
            oc.onEnd(end => {
                callback(`${indentation}}${suffix} // ${printLoc(end)}`)
            })
        },
        value: (value, range) => {
            callback(`${indentation}${format(value)}${suffix} // ${printRange(range)}`)
        },
    }
}