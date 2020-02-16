import * as fs  from "fs"
import { Tokenizer, lax, DataSubscriber, Parser } from "../src/Parser"
import * as sp from "../src/createStackedDataSubscriber"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, {encoding: "utf-8"})

export function createValuesPrettyPrinter(indentation: string, writer: (str: string) => void): sp.ValueHandler {
    return {
        array: (_startLocation, openCharacter) => {
            writer(openCharacter)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                end: ((_endLocation, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                }),
            }

        },
        object: (_startlocation, openCharacter) => {
            writer(openCharacter)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}\t"${key}": `)
                    return createValuesPrettyPrinter(`${indentation}\t`, writer)
                },
                end: (_endLocation, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                },
            }
        },
        boolean: isTrue => {
            writer(`${isTrue ? "true":"false"}`)
        },
        number: value => {
            writer(`${value.toString(10)}`)//JSON.stringify(value)
        },
        string: value => {
            writer(`${JSON.stringify(value)}`)//JSON.stringify(value)
        },
        null: () => {
            writer(`null`)
        },
        taggedUnion: (option, _unionStart, _optionRange) => {
            writer(`| "${option}" `)
            return createValuesPrettyPrinter(`${indentation}`, writer)
        },
    }
}

export function createPrettyPrinter(indentation: string, writer: (str: string) => void): DataSubscriber {
    return sp.createStackedDataSubscriber(
        createValuesPrettyPrinter(indentation, writer),
        () => {
            //
        }
    )
}

const parser = new Parser({ allow: lax})
const tokenizer = new Tokenizer(parser)
parser.ondata.subscribe(createPrettyPrinter("\r\n", str => process.stdout.write(str)))
parser.onerror.subscribe(err => { console.error("FOUND PARSER ERROR", err.message) })
tokenizer.onerror.subscribe(err => { console.error("FOUND TOKENIZER ERROR", err.message) })
tokenizer.write(data)
tokenizer.end()
