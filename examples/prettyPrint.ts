import * as p from "pareto"
import * as p20 from "pareto-20"
import * as bc from "../src"
import * as fs from "fs"
import { ParserEvent, ParserEventConsumer } from "../src"


const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

function createRequiredValuesPrettyPrinter(indentation: string, writer: (str: string) => void): bc.RequiredValueHandler {
    return {
        valueHandler: createValuesPrettyPrinter(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesPrettyPrinter(indentation: string, writer: (str: string) => void): bc.ValueHandler {
    return {
        array: (beginRange, beginMetaData) => {
            writer(beginMetaData.openCharacter)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                end: _endRange => {
                    writer(`${indentation}${bc.printRange(beginRange)}`)
                },
            }

        },
        object: (_range, data) => {
            writer(data.openCharacter)
            return {
                property: (_keyRange, key) => {
                    writer(`${indentation}\t"${key}": `)
                    return createRequiredValuesPrettyPrinter(`${indentation}\t`, writer)
                },
                end: range => {
                    writer(`${indentation}${bc.printRange(range)}`)
                },
            }
        },
        simpleValue: (_range, data) => {
            if (data.quote !== null) {
                writer(`${JSON.stringify(data.value)}`)
            } else {
                writer(`${data.value}`)
            }
            return p.result(false)
        },
        taggedUnion: () => {
            return {
                option: (_range, option) => {
                    writer(`| "${option}" `)
                    return createRequiredValuesPrettyPrinter(`${indentation}`, writer)
                },
                missingOption: () => {
                    //
                },
            }
        },
    }
}

export function createPrettyPrinter(indentation: string, writer: (str: string) => void): ParserEventConsumer<null, null> {
    const datasubscriber = bc.createStackedDataSubscriber<null, null>(
        {
            valueHandler: createValuesPrettyPrinter(indentation, writer),
            onMissing: () => {
                //
            },
        },
        error => {
            console.error("FOUND STACKED DATA ERROR", error.message)
        },
        _comments => {
            //onEnd
            return p.success(null)
        }
    )
    return datasubscriber
}

const pp = createPrettyPrinter("\r\n", str => process.stdout.write(str))

const prsr = bc.createParser(
    err => { console.error("FOUND PARSER ERROR", err) },
    {
        onHeaderStart: () => {
            return pp
        },
        onCompact: () => {
            //
        },
        onHeaderEnd: () => {
            return pp
        },
    },
)

createPrettyPrinter("\r\n", str => process.stdout.write(str))


p20.createArray([dataAsString]).streamify().handle(
    null,
    bc.createStreamTokenizer(
        prsr,
        err => { console.error("FOUND TOKENIZER ERROR", err) },
    )
)
