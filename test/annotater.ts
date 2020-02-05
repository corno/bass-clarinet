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
            console.log(`${indentation}"${key}": [ // ${printRange(keyRange)}`, printLoc(ac.start))
            ac.onElement(createValuesAnnotater(`${indentation}\t`, callback, false))
            ac.onEnd(end => {
                console.log(`${indentation}], // "${key}"`, printLoc(end))
            })
        },
        object: (key, oc, keyRange) => {
            console.log(`${indentation}"${key}": { // ${printRange(keyRange)}`, printLoc(oc.start))
            oc.onProperty(createPropertiesAnnotater(`${indentation}\t`, callback))
            oc.onEnd(end => {
                console.log(`${indentation}}, // "${key}"`, printLoc(end))
            })
        },
        value: (key, value, range, keyRange) => {
            console.log(`${indentation}"${key}": ${format(value)}, //${printRange(keyRange)}`, printRange(range))
        },
    }
}

export function createValuesAnnotater(indentation: string, callback: (str: string) => void, isRoot: boolean): sp.ValueSubscribers {
    const suffix = isRoot ? "" : ","
    return {
        array: (ac) => {
            console.log(`${indentation}[ //`, printLoc(ac.start))
            ac.onElement(createValuesAnnotater(`${indentation}\t`, callback, false))
            ac.onEnd(end => {
                console.log(`${indentation}]${suffix} //`, printLoc(end))
            })
        },
        object: (oc) => {
            console.log(`${indentation}{ //`, printLoc(oc.start))
            oc.onProperty(createPropertiesAnnotater(`${indentation}\t`, callback))
            oc.onEnd(end => {
                console.log(`${indentation}}${suffix} //`, printLoc(end))
            })
        },
        value: (value, range) => {
            console.log(`${indentation}${format(value)}${suffix} //`, printRange(range))
        },
    }
}