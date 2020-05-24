import * as bc from "../src"
import { IDataSubscriber } from "../src"

function createRequiredValuesAnnotater(indentation: string, writer: (str: string) => void): bc.RequiredValueHandler {
    return {
        valueHandler: createValuesAnnotater(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesAnnotater(indentation: string, writer: (str: string) => void): bc.ValueHandler {
    return {
        array: beginRange => {
            writer(`${indentation}[ // ${bc.printRange(beginRange)}`)
            return {
                element: () => createValuesAnnotater(`${indentation}\t`, writer),
                end: endRange => {
                    writer(`${indentation}] // ${bc.printRange(endRange)}`)
                },
            }
        },
        object: beginRange => {
            writer(`${indentation}{ // ${bc.printRange(beginRange)}`)
            return {
                property: (_keyRange, key) => {
                    writer(`${indentation}"${key}": `)
                    return createRequiredValuesAnnotater(`${indentation}\t`, writer)
                },
                end: (range, _endMetaData) => {
                    writer(`${indentation}} // ${bc.printRange(range)}`)
                },
            }
        },
        simpleValue: (range, data) => {
            if (data.quote !== null) {
                writer(`${indentation}${JSON.stringify(data.value)} // ${bc.printRange(range)}`)
            } else {
                writer(`${indentation}${data.value} // ${bc.printRange(range)}`)
            }
        },
        taggedUnion: (range, _taggedUnionData) => {
            writer(`| ${indentation}`)
            return {
                option: (_range, option, _optionData) => {
                    writer(`"${JSON.stringify(option)}" // ${bc.printRange(range)} ${bc.printRange(range)}`)
                    return createRequiredValuesAnnotater(`${indentation}\t`, writer)
                },
                missingOption: () => {
                    //
                },
            }
        },
    }
}

export function createAnnotator(indentation: string, writer: (str: string) => void): IDataSubscriber {
    const ds = bc.createStackedDataSubscriber(
        createRequiredValuesAnnotater(indentation, writer),
        error => {
            throw new bc.RangeError(error.message, error.range)
        },
        () => {
            //do nothing
        }
    )
    return ds
}