import * as bc from "../src"

export function createValuesAnnotater(indentation: string, writer: (str: string) => void): bc.ValueHandler {
    return {
        array: beginMetaData => {
            writer(`${indentation}[ // ${bc.printRange(beginMetaData.start)}`)
            return {
                element: () => createValuesAnnotater(`${indentation}\t`, writer),
                end: endMetaData => {
                    writer(`${indentation}] // ${bc.printRange(endMetaData.range)}`)
                },
            }
        },
        object: beginMetaData => {
            writer(`${indentation}{ // ${bc.printRange(beginMetaData.start)}`)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}"${key}": `)
                    return {
                        onMissing: () => {
                            //write out an empty string to fix this missing data?
                        },
                        onValue: createValuesAnnotater(`${indentation}\t`, writer),
                    }
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
                onOption: (option, optionData) => {
                    writer(`"${JSON.stringify(option)}" // ${bc.printRange(taggedUnionData.startRange)} ${bc.printRange(optionData.range)}`)

                    return {
                        onValue: createValuesAnnotater(`${indentation}\t`, writer),
                        onMissing: () => {
                            //
                        },
                    }
                },
                onMissingOption: () => {
                    //
                },
            }
        },
    }
}

export function attachAnnotator(parser: bc.Parser, indentation: string, writer: (str: string) => void) {
    const ds = bc.createStackedDataSubscriber(
        createValuesAnnotater(indentation, writer),
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