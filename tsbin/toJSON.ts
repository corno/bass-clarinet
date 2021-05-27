import * as p from "pareto"
import * as fs from "fs"
import * as astn from "../src"
import * as stream from "stream"

const [, , sourcePath, targetPath] = process.argv

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}


const ws: stream.Writable = targetPath !== undefined
    ? fs.createWriteStream(targetPath, { encoding: "utf-8" })
    : process.stdout


if (sourcePath === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(sourcePath, { encoding: "utf-8" })

function createRequiredValuePrettyPrinter<Annotation>(indentation: string, writer: (str: string) => void): astn.RequiredValueHandler<Annotation> {
    return {
        exists: createValuePrettyPrinter(indentation, writer),
        missing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuePrettyPrinter<Annotation>(indentation: string, writer: (str: string) => void): astn.ValueHandler<Annotation> {
    return {
        array: _arrayData => {
            writer(`[`)
            return {
                element: () => createValuePrettyPrinter(`${indentation}\t`, writer),
                arrayEnd: () => {
                    writer(`${indentation}]`)
                    return p.value(null)
                },
            }

        },
        object: _objectData => {
            let isFirstProperty = true
            writer(`{`)
            return {
                property: propertyData => {
                    writer(`${isFirstProperty ? `` : `, `}${indentation}\t"${propertyData.data.key}": `)
                    isFirstProperty = false
                    return p.value(createRequiredValuePrettyPrinter(`${indentation}\t`, writer))
                },
                objectEnd: () => {
                    writer(`${indentation}}`)
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
                    writer(`[ "${optionData.data.option}", `)
                    return createRequiredValuePrettyPrinter(`${indentation}`, writer)
                },
                missingOption: () => {
                    //
                },
                end: () => {
                    write(`]`)
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

export function createDummyEventConsumer(): astn.TextParserEventConsumer<null, null> {
    const datasubscriber = astn.createStackedParser<null, null>(
        {
            exists: astn.createDummyValueHandler(),
            missing: () => {
                //
            },
        },
        _error => {
            //
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
    ws.write(str)
}

astn.parseString(
    dataAsString,
    _range => {
        return createDummyEventConsumer()
    },
    () => {
        return createPrettyPrinter("\r\n", write)
    },
    err => { console.error("FOUND ERROR", astn.printParsingError(err)) },
    _overheadToken => {
        return p.value(false)
    },
).handle(
    () => {
        write("\r\n")
        //we're only here for the side effects, so no need to handle the error
        ws.end()
    },
    () => {
        write("\r\n")
        //we're only here for the side effects, so no need to handle the result (which is 'null' anyway)
        ws.end()
    }
)
