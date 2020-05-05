import * as bc from "../src"
import * as fs from "fs"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, { encoding: "utf-8" })

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
        array: beginMetaData => {
            writer(beginMetaData.openCharacter)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                end: endMetaData => {
                    writer(`${indentation}${endMetaData.range}`)
                },
            }

        },
        object: metaData => {
            writer(metaData.openCharacter)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}\t"${key}": `)
                    return createRequiredValuesPrettyPrinter(`${indentation}\t`, writer)
                },
                end: endMetaData => {
                    writer(`${indentation}${endMetaData.range}`)
                },
            }
        },
        simpleValue: (value, metaData) => {
            if (metaData.quote !== null) {
                writer(`${JSON.stringify(value)}`)
            } else {
                writer(`${value}`)
            }
        },
        taggedUnion: () => {
            return {
                option: option => {
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

export function attachPrettyPrinter(parser: bc.Parser, indentation: string, writer: (str: string) => void) {
    const datasubscriber = bc.createStackedDataSubscriber(
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
        }
    )
    parser.ondata.subscribe(datasubscriber)
    parser.onschemadata.subscribe(datasubscriber)
}


const prsr = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
)

attachPrettyPrinter(prsr, "\r\n", str => process.stdout.write(str))

bc.tokenizeString(
    prsr,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    data
)
