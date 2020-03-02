import * as bc from "../src"

export function createValuesAnnotater(indentation: string, writer: (str: string) => void): bc.ValueHandler {
    return {
        array: start => {
            writer(`${indentation}[ // ${bc.printRange(start)}`)
            return {
                element: () => createValuesAnnotater(`${indentation}\t`, writer),
                end: (end => {
                    writer(`${indentation}] // ${bc.printRange(end)}`)
                }),
            }
        },
        object: start => {
            writer(`${indentation}{ // ${bc.printRange(start)}`)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}"${key}": `)
                    return createValuesAnnotater(`${indentation}\t`, writer)
                },
                end: end => {
                    writer(`${indentation}} // ${bc.printRange(end)}`)
                },
            }
        },
        quotedString: (value, range) => {
            writer(`${indentation}${JSON.stringify(value)} // ${bc.printRange(range)}`)
        },
        unquotedToken: (value, range) => {
            writer(`${indentation}${value} // ${bc.printRange(range)}`)
        },
        taggedUnion: (option, startRange, _tuComments, optionRange, _optionComments) => {
            writer(`| ${indentation}"${JSON.stringify(option)}" // ${bc.printRange(startRange)} ${bc.printRange(optionRange)}`)
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