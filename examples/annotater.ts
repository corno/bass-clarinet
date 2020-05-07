import * as bc from "../src"

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
        array: beginMetaData => {
            writer(`${indentation}[ // ${bc.printRange(beginMetaData.range)}`)
            return {
                element: () => createValuesAnnotater(`${indentation}\t`, writer),
                end: endMetaData => {
                    writer(`${indentation}] // ${bc.printRange(endMetaData.range)}`)
                },
            }
        },
        object: beginMetaData => {
            writer(`${indentation}{ // ${bc.printRange(beginMetaData.range)}`)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}"${key}": `)
                    return createRequiredValuesAnnotater(`${indentation}\t`, writer)
                },
                end: endMetaData => {
                    writer(`${indentation}} // ${bc.printRange(endMetaData.range)}`)
                },
            }
        },
        simpleValue: (value, metaData) => {
            if (metaData.quote !== null) {
                writer(`${indentation}${JSON.stringify(value)} // ${bc.printRange(metaData.range)}`)
            } else {
                writer(`${indentation}${value} // ${bc.printRange(metaData.range)}`)
            }
        },
        taggedUnion: taggedUnionData => {
            writer(`| ${indentation}`)
            return {
                option: (option, optionData) => {
                    writer(`"${JSON.stringify(option)}" // ${bc.printRange(taggedUnionData.range)} ${bc.printRange(optionData.range)}`)

                    return createRequiredValuesAnnotater(`${indentation}\t`, writer)
                },
                missingOption: () => {
                    //
                },
            }
        },
    }
}

export function attachAnnotator(parser: bc.Parser, indentation: string, writer: (str: string) => void) {
    const ds = bc.createStackedDataSubscriber(
        createRequiredValuesAnnotater(indentation, writer),
        error => {
            throw new bc.RangeError(error.message, error.range)
        },
        () => {
            //do nothing
        }
    )
    parser.ondata.subscribe(ds)
    parser.onschemadata.subscribe(ds)
}