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

function createRequiredValuePrettyPrinter<Annotation>(indentation: string, writer: (str: string) => void): astn.RequiredValueHandler<Annotation> {
    return {
        onExists: createValuePrettyPrinter(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuePrettyPrinter<Annotation>(indentation: string, writer: (str: string) => void): astn.ValueHandler<Annotation> {
    return {
        array: arrayData => {

            writer(arrayData.type[0] === "shorthand type" ? "<" : "[")
            return {
                onData: () => createValuePrettyPrinter(`${indentation}\t`, writer),
                onEnd: () => {
                    writer(`${indentation}${arrayData.type[0] === "shorthand type" ? ">" : "]"}`)
                    return p.value(null)
                },
            }

        },
        object: objectData => {
            writer(objectData.type[0] === "verbose type" ? "(" : "{")
            return {
                onData: propertyData => {
                    writer(`${indentation}\t"${propertyData.key}": `)
                    return p.value(createRequiredValuePrettyPrinter(`${indentation}\t`, writer))
                },
                onEnd: () => {
                    writer(`${indentation}${objectData.type[0] === "verbose type" ? ")" : "}"}`)
                    return p.value(null)
                },
            }
        },
        simpleValue: svData => {
            switch (svData.wrapper[0]) {
                case "none": {
                    writer(`${svData.value}`)

                    break
                }
                case "backtick": {
                    writer(`FIXME BACKTICK${JSON.stringify(svData.value)}`)

                    break
                }
                case "quote": {
                    writer(`${JSON.stringify(svData.value)}`)

                    break
                }
                default:
                    assertUnreachable(svData.wrapper[0])
            }
            return p.value(false)
        },
        taggedUnion: () => {
            return {
                option: optionData => {
                    writer(`| "${optionData.option}" `)
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

export function createPrettyPrinter(indentation: string, writer: (str: string) => void): astn.TextParserEventConsumer<null, null> {
    const datasubscriber = astn.createStackedParser<null, null>(
        {
            onExists: createValuePrettyPrinter(indentation, writer),
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
    () => {
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
