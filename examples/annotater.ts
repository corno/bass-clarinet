import * as p from "pareto"
import * as astn from "../src"

function createRequiredValuesAnnotater<Annotation>(
    indentation: string,
    writer: (str: string) => void,
    printAnnotation: (annotation: Annotation) => string
): astn.RequiredValueHandler<Annotation> {
    return {
        onExists: createValuesAnnotater(indentation, writer, printAnnotation),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesAnnotater<Annotation>(indentation: string, writer: (str: string) => void, printAnnotation: (annotation: Annotation) => string): astn.ValueHandler<Annotation> {
    return {
        array: arrayData => {
            writer(`${indentation}[ // ${printAnnotation(arrayData.annotation)}`)
            return {
                onData: () => createValuesAnnotater(`${indentation}\t`, writer, printAnnotation),
                onEnd: endData => {
                    writer(`${indentation}] // ${printAnnotation(endData.annotation)}`)
                    return p.value(null)
                },
            }
        },
        object: objectData => {
            writer(`${indentation}{ // ${printAnnotation(objectData.annotation)}`)
            return {
                onData: propertyData => {
                    writer(`${indentation}"${propertyData.key}": `)
                    return p.value(createRequiredValuesAnnotater(`${indentation}\t`, writer, printAnnotation))
                },
                onEnd: endData => {
                    writer(`${indentation}} // ${printAnnotation(endData.annotation)}`)
                    return p.value(null)
                },
            }
        },
        simpleValue: svData => {
            if (svData.wrapper[0] !== "none") {
                writer(`${indentation}${JSON.stringify(svData.value)} // ${printAnnotation(svData.annotation)}`)
            } else {
                writer(`${indentation}${svData.value} // ${printAnnotation(svData.annotation)}`)
            }
            return p.value(false)
        },
        taggedUnion: tuData => {
            writer(`| ${indentation}`)
            return {
                option: optionData => {
                    writer(`"${JSON.stringify(optionData.option)}" // ${printAnnotation(tuData.annotation)} ${printAnnotation(tuData.annotation)}`)
                    return createRequiredValuesAnnotater(`${indentation}\t`, writer, printAnnotation)
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

export function createAnnotator(indentation: string, writer: (str: string) => void): astn.TextParserEventConsumer<null, null> {
    const ds = astn.createStackedParser<null, null>(
        createRequiredValuesAnnotater(
            indentation,
            writer,
            annotation => {
                return astn.printRange(annotation.range)
            }
        ),
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