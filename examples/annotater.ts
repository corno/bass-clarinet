import * as p from "pareto"
import * as bc from "../src"
import { ParserEventConsumer } from "../src"

function createRequiredValuesAnnotater(indentation: string, writer: (str: string) => void): bc.RequiredValueHandler {
    return {
        onValue: createValuesAnnotater(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesAnnotater(indentation: string, writer: (str: string) => void): bc.OnValue {
    return () => {
        return {
            array: range => {
                writer(`${indentation}[ // ${bc.printRange(range)}`)
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
                        return p.result(createRequiredValuesAnnotater(`${indentation}\t`, writer))
                    },
                    end: (endRange, _endMetaData) => {
                        writer(`${indentation}} // ${bc.printRange(endRange)}`)
                    },
                }
            },
            simpleValue: (range, data) => {
                if (data.quote !== null) {
                    writer(`${indentation}${JSON.stringify(data.value)} // ${bc.printRange(range)}`)
                } else {
                    writer(`${indentation}${data.value} // ${bc.printRange(range)}`)
                }
                return p.result(false)
            },
            taggedUnion: range => {
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
}

export function createAnnotator(indentation: string, writer: (str: string) => void): ParserEventConsumer<null, null> {
    const ds = bc.createStackedDataSubscriber<null, null>(
        createRequiredValuesAnnotater(indentation, writer),
        (error, range) => {
            throw new bc.RangeError(error[0], range)
        },
        () => {
            //do nothing
            return p.success(null)
        }
    )
    return ds
}