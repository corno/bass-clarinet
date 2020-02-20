import * as sp from "../src/stackedDataSubscriber"
import { printRange } from "../src/location"
import { DataSubscriber, LocationError, RangeError } from "../src"

export function createValuesAnnotater(indentation: string, writer: (str: string) => void): sp.ValueHandler {
    return {
        array: start => {
            writer(`${indentation}[ // ${printRange(start)}`)
            return {
                element: () => createValuesAnnotater(`${indentation}\t`, writer),
                end: (end => {
                    writer(`${indentation}] // ${printRange(end)}`)
                }),
            }
        },
        object: start => {
            writer(`${indentation}{ // ${printRange(start)}`)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}"${key}": `)
                    return createValuesAnnotater(`${indentation}\t`, writer)
                },
                end: end => {
                    writer(`${indentation}} // ${printRange(end)}`)
                },
            }
        },
        string: (value, range) => {
            writer(`${indentation}${JSON.stringify(value)} // ${printRange(range)}`)
        },
        boolean: (value, range) => {
            writer(`${indentation}${value ? "true" : "false"} // ${printRange(range)}`)
        },
        number: (value, range) => {
            writer(`${indentation}${value.toString(10)} // ${printRange(range)}`)
        },
        null: range => {
            writer(`${indentation}null // ${printRange(range)}`)
        },
        taggedUnion: (option, startRange, _tuComments, optionRange, _optionComments) => {
            writer(`| ${indentation}"${JSON.stringify(option)}" // ${printRange(startRange)} ${printRange(optionRange)}`)
            return createValuesAnnotater(`${indentation}\t`, writer)
        },
    }
}

export function createAnnotator(indentation: string, writer: (str: string) => void): DataSubscriber {
    return sp.createStackedDataSubscriber(
        createValuesAnnotater(indentation, writer),
        error => {
            if (error.context[0] === "range") {
                throw new RangeError(error.message, error.context[1])
            } else {
                throw new LocationError(error.message, error.context[1])

            }
        },
        () => {
            //do nothing
        }
    )
}