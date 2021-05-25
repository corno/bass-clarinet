import * as p from "pareto"
import * as astn from "../src"
import { ParserEventConsumer } from "../src"

function createRequiredValuesAnnotater(indentation: string, writer: (str: string) => void): astn.RequiredValueHandler {
    return {
        onValue: createValuesAnnotater(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesAnnotater(indentation: string, writer: (str: string) => void): astn.OnValue {
    return () => {
        return {
            array: range => {
                writer(`${indentation}[ // ${astn.printRange(range)}`)
                return {
                    onData: () => createValuesAnnotater(`${indentation}\t`, writer),
                    onEnd: endData => {
                        writer(`${indentation}] // ${astn.printRange(endData.range)}`)
                        return p.value(null)
                    },
                }
            },
            object: beginRange => {
                writer(`${indentation}{ // ${astn.printRange(beginRange)}`)
                return {
                    onData: propertyData => {
                        writer(`${indentation}"${propertyData.key}": `)
                        return p.value(createRequiredValuesAnnotater(`${indentation}\t`, writer))
                    },
                    onEnd: endData => {
                        writer(`${indentation}} // ${astn.printRange(endData.range)}`)
                        return p.value(null)
                    },
                }
            },
            simpleValue: (range, data) => {
                if (data.quote !== null) {
                    writer(`${indentation}${JSON.stringify(data.value)} // ${astn.printRange(range)}`)
                } else {
                    writer(`${indentation}${data.value} // ${astn.printRange(range)}`)
                }
                return p.value(false)
            },
            taggedUnion: range => {
                writer(`| ${indentation}`)
                return {
                    option: (_range, option, _optionData) => {
                        writer(`"${JSON.stringify(option)}" // ${astn.printRange(range)} ${astn.printRange(range)}`)
                        return createRequiredValuesAnnotater(`${indentation}\t`, writer)
                    },
                    missingOption: () => {
                        //
                    },
                    end: () => {
                        //
                    },
                }
            },
        }
    }
}

export function createAnnotator(indentation: string, writer: (str: string) => void): ParserEventConsumer<null, null> {
    const ds = astn.createStackedDataSubscriber<null, null>(
        createRequiredValuesAnnotater(indentation, writer),
        (error, range) => {
            throw new astn.RangeError(error[0], range)
        },
        () => {
            //do nothing
            return p.success(null)
        }
    )
    return ds
}