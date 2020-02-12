import * as sp from "../src/cerateStackedDataSubscriber"
import { Location, Range } from "../src/location"
import { DataSubscriber } from "../src"


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

export function createValuesAnnotater(indentation: string, writer: (str: string) => void): sp.ValueHandler {
    return {
        array: (startLocation) => {
            writer(`${indentation}[ // ${printLoc(startLocation)}`)
            return {
                element: () => createValuesAnnotater(`${indentation}\t`, writer),
                end: (end => {
                    writer(`${indentation}] // ${printLoc(end)}`)
                })
            }
        },
        object: (startLocation) => {
            writer(`${indentation}{ // ${printLoc(startLocation)}`)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}"${key}": `)
                    return createValuesAnnotater(`${indentation}\t`, writer)
                },
                end: (end) => {
                    writer(`${indentation}} // ${printLoc(end)}`)
                },
            }
        },
        simpleValue: (value, range) => {
            writer(`${indentation}${format(value)} // ${printRange(range)}`)
        },
        null: (range) => {
            writer(`${indentation}null // ${printRange(range)}`)
        },
        typedUnion: (option, startLocation, range) => {
            writer(`| ${indentation}"${JSON.stringify(option)}" // ${printLoc(startLocation)} ${printRange(range)}`)
            return createValuesAnnotater(`${indentation}\t`, writer)
        },
    }
}

export function createAnnotator(indentation: string, writer: (str: string) => void): DataSubscriber {
    return sp.createStackedDataSubscriber(
        createValuesAnnotater(indentation, writer),
        () => { }
    )
}