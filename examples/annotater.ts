import * as p from "pareto"
import * as astn from "../src"

function createRequiredValuesAnnotater<TokenAnnotation, NonTokenAnnotation>(
    indentation: string,
    writer: (str: string) => void,
    printAnnotation: (annotation: TokenAnnotation) => string
): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> {
    return {
        exists: createValuesAnnotater(indentation, writer, printAnnotation),
        missing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesAnnotater<TokenAnnotation, NonTokenAnnotation>(
    indentation: string,
    writer: (str: string) => void,
    printAnnotation: (annotation: TokenAnnotation) => string
): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {
    return {
        array: $ => {
            writer(`${indentation}[ // ${printAnnotation($.annotation)}`)
            return {
                element: () => createValuesAnnotater(`${indentation}\t`, writer, printAnnotation),
                arrayEnd: endData => {
                    writer(`${indentation}] // ${printAnnotation(endData.annotation)}`)
                    return p.value(null)
                },
            }
        },
        object: $ => {
            writer(`${indentation}{ // ${printAnnotation($.annotation)}`)
            return {
                property: propertyData => {
                    writer(`${indentation}"${propertyData.data.key}": `)
                    return p.value(createRequiredValuesAnnotater(`${indentation}\t`, writer, printAnnotation))
                },
                objectEnd: endData => {
                    writer(`${indentation}} // ${printAnnotation(endData.annotation)}`)
                    return p.value(null)
                },
            }
        },
        simpleValue: $ => {
            if ($.data.wrapper[0] !== "none") {
                writer(`${indentation}${JSON.stringify($.data.value)} // ${printAnnotation($.annotation)}`)
            } else {
                writer(`${indentation}${$.data.value} // ${printAnnotation($.annotation)}`)
            }
            return p.value(false)
        },
        taggedUnion: $ => {
            writer(`| ${indentation}`)
            return {
                option: optionData => {
                    writer(`"${JSON.stringify(optionData.data.option)}" // ${printAnnotation($.annotation)} ${printAnnotation($.annotation)}`)
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