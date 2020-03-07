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
                    return createValuesAnnotater(`${indentation}\t`, writer)
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
        taggedUnion: (option, metaData) => {
            writer(`| ${indentation}"${JSON.stringify(option)}" // ${bc.printRange(metaData.startRange)} ${bc.printRange(metaData.optionRange)}`)
            return createValuesAnnotater(`${indentation}\t`, writer)
        },
    }
}

export function attachAnnotator(parser: bc.Parser, indentation: string, writer: (str: string) => void) {
    const ds = bc.createStackedDataSubscriber(
        createValuesAnnotater(indentation, writer),
        error => {
            if (error.context[0] === "range") {
                throw new bc.RangeError(error.message, error.context[1])
            } else {
                throw new bc.LocationError(error.message, error.context[1])

            }
        },
        () => {
            //do nothing
        }
    )
    parser.ondata.subscribe(ds)
    parser.onschemadata.subscribe(ds)
}