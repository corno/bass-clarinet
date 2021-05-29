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

function createRequiredValuePrettyPrinter<TokenAnnotation, NonTokenAnnotation>(indentation: string, writer: (str: string) => void): astn.RequiredValueHandler<TokenAnnotation, NonTokenAnnotation> {
    return {
        exists: createValuePrettyPrinter(indentation, writer),
        missing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuePrettyPrinter<TokenAnnotation, NonTokenAnnotation>(indentation: string, writer: (str: string) => void): astn.ValueHandler<TokenAnnotation, NonTokenAnnotation> {
    return {
        array: arrayData => {

            writer(arrayData.data.type[0] === "shorthand type" ? "<" : "[")
            return {
                element: () => createValuePrettyPrinter(`${indentation}\t`, writer),
                arrayEnd: () => {
                    writer(`${indentation}${arrayData.data.type[0] === "shorthand type" ? ">" : "]"}`)
                    return p.value(null)
                },
            }

        },
        object: objectData => {
            writer(objectData.data.type[0] === "verbose type" ? "(" : "{")
            return {
                property: propertyData => {
                    writer(`${indentation}\t"${propertyData.data.key}": `)
                    return p.value(createRequiredValuePrettyPrinter(`${indentation}\t`, writer))
                },
                objectEnd: () => {
                    writer(`${indentation}${objectData.data.type[0] === "verbose type" ? ")" : "}"}`)
                    return p.value(null)
                },
            }
        },
        simpleValue: svData => {
            switch (svData.data.wrapper[0]) {
                case "none": {
                    writer(`${svData.data.value}`)

                    break
                }
                case "backtick": {
                    writer(`FIXME BACKTICK${JSON.stringify(svData.data.value)}`)

                    break
                }
                case "quote": {
                    writer(`${JSON.stringify(svData.data.value)}`)

                    break
                }
                default:
                    assertUnreachable(svData.data.wrapper[0])
            }
            return p.value(false)
        },
        taggedUnion: () => {
            return {
                option: optionData => {
                    writer(`| "${optionData.data.option}" `)
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
            exists: createValuePrettyPrinter(indentation, writer),
            missing: () => {
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
