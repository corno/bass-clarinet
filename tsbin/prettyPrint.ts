import * as p from "pareto"
import * as fs from "fs"
import * as astn from "../src"
import { printParsingError } from "../src"

const [, , path] = process.argv

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

function createRequiredValuePrettyPrinter(indentation: string, writer: (str: string) => void): astn.RequiredValueHandler {
    return {
        onValue: createValuePrettyPrinter(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuePrettyPrinter(indentation: string, writer: (str: string) => void): astn.OnValue {
    return () => {
        return {
            array: (_beginRange, beginMetaData) => {
                writer(beginMetaData.openCharacter)
                return {
                    element: () => createValuePrettyPrinter(`${indentation}\t`, writer),
                    end: (_endRange, endData) => {
                        writer(`${indentation}${endData.closeCharacter}`)
                    },
                }

            },
            object: (_beginRange, data) => {
                writer(data.openCharacter)
                return {
                    property: (_keyRange, key) => {
                        writer(`${indentation}\t"${key}": `)
                        return p.value(createRequiredValuePrettyPrinter(`${indentation}\t`, writer))
                    },
                    end: (_endRange, endData) => {
                        writer(`${indentation}${endData.closeCharacter}`)
                    },
                }
            },
            simpleValue: (_range, data) => {
                if (data.quote !== null) {
                    writer(`${JSON.stringify(data.value)}`)
                } else {
                    writer(`${data.value}`)
                }
                return p.value(false)
            },
            taggedUnion: () => {
                return {
                    option: (_range, option) => {
                        writer(`| "${option}" `)
                        return createRequiredValuePrettyPrinter(`${indentation}`, writer)
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

export function createPrettyPrinter(indentation: string, writer: (str: string) => void): astn.ParserEventConsumer<null, null> {
    const datasubscriber = astn.createStackedDataSubscriber<null, null>(
        {
            onValue: createValuePrettyPrinter(indentation, writer),
            onMissing: () => {
                console.error("FOUND MISSING DATA")

            },
        },
        error => {
            console.error("FOUND STACKED DATA ERROR", error)
        },
        () => {
            //onEnd
            //no need to return an value, we're only here for the side effects, so return 'null'
            return p.success(null)
        }
    )
    return datasubscriber
}

function write(str: string) {
    process.stdout.write(str)
}

astn.parseString(
    dataAsString,
    _range => {
        write("! ")
        return createPrettyPrinter("\r\n", write)
    },
    compactRange => {
        if (compactRange !== null) {
            write("# ")
        }
        return createPrettyPrinter("\r\n", write)
    },
    err => { console.error("FOUND ERROR", printParsingError(err)) },
    overheadToken => {
        switch (overheadToken.type[0]) {
            case astn.OverheadTokenType.Comment: {
                //const $ = data.type[1]

                break
            }
            case astn.OverheadTokenType.NewLine: {
                //const $ = data.type[1]

                break
            }
            case astn.OverheadTokenType.WhiteSpace: {
                //const $ = data.type[1]

                break
            }
            default:
                assertUnreachable(overheadToken.type[0])
        }
        write("\r\n")
        return p.value(false)
    },
).handle(
    () => {
        write("\r\n")
        //we're only here for the side effects, so no need to handle the error
    },
    () => {
        write("\r\n")
        //we're only here for the side effects, so no need to handle the result (which is 'null' anyway)
    }
)
