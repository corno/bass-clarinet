import * as p from "pareto"
import * as astn from "../src"
import { ParserAnnotationData, TextParserEventConsumer } from "../src"

function createRequiredValuesAnnotater(indentation: string, writer: (str: string) => void): astn.RequiredValueHandler<ParserAnnotationData> {
    return {
        onExists: createValuesAnnotater(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesAnnotater(indentation: string, writer: (str: string) => void): astn.ValueHandler<ParserAnnotationData> {
    return {
        array: arrayData => {
            writer(`${indentation}[ // ${astn.printRange(arrayData.annotation.range)}`)
            return {
                onData: () => createValuesAnnotater(`${indentation}\t`, writer),
                onEnd: endData => {
                    writer(`${indentation}] // ${astn.printRange(endData.annotation.range)}`)
                    return p.value(null)
                },
            }
        },
        object: objectData => {
            writer(`${indentation}{ // ${astn.printRange(objectData.annotation.range)}`)
            return {
                onData: propertyData => {
                    writer(`${indentation}"${propertyData.key}": `)
                    return p.value(createRequiredValuesAnnotater(`${indentation}\t`, writer))
                },
                onEnd: endData => {
                    writer(`${indentation}} // ${astn.printRange(endData.annotation.range)}`)
                    return p.value(null)
                },
            }
        },
        simpleValue: svData => {
            if (svData.data.quote !== null) {
                writer(`${indentation}${JSON.stringify(svData.data.value)} // ${astn.printRange(svData.annotation.range)}`)
            } else {
                writer(`${indentation}${svData.data.value} // ${astn.printRange(svData.annotation.range)}`)
            }
            return p.value(false)
        },
        taggedUnion: tuData => {
            writer(`| ${indentation}`)
            return {
                option: optionData => {
                    writer(`"${JSON.stringify(optionData.option)}" // ${astn.printRange(tuData.annotation.range)} ${astn.printRange(tuData.annotation.range)}`)
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

export function createAnnotator(indentation: string, writer: (str: string) => void): TextParserEventConsumer<null, null> {
    const ds = astn.createStackedParser<null, null>(
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