import * as bc from "../src"
import * as fs  from "fs"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, {encoding: "utf-8"})

export function createValuesPrettyPrinter(indentation: string, writer: (str: string) => void): bc.ValueHandler {
    return {
        array: (_startLocation, openCharacter, _comments) => {
            writer(openCharacter)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                end: ((_endLocation, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                }),
            }

        },
        object: (_startlocation, openCharacter, _comments) => {
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
        boolean: (isTrue, _range, _comments) => {
            writer(`${isTrue ? "true":"false"}`)
        },
        number: (value, _range, _comments) => {
            writer(`${value.toString(10)}`)//JSON.stringify(value)
        },
        string: (value, _range, _comments) => {
            writer(`${JSON.stringify(value)}`)//JSON.stringify(value)
        },
        null: _comments => {
            writer(`null`)
        },
        taggedUnion: (option, _unionStart, _optionRange, _comments) => {
            writer(`| "${option}" `)
            return createValuesPrettyPrinter(`${indentation}`, writer)
        },
    }
}

export function createPrettyPrinter(indentation: string, writer: (str: string) => void): bc.DataSubscriber {
    return bc.createStackedDataSubscriber(
        createValuesPrettyPrinter(indentation, writer),
        _comments => {
            //onEnd
        }
    )
}

const parser = new bc.Parser({ allow: bc.lax})
const tokenizer = new bc.Tokenizer(parser)
parser.ondata.subscribe(createPrettyPrinter("\r\n", str => process.stdout.write(str)))
parser.onerror.subscribe(err => { console.error("FOUND PARSER ERROR", err.message) })
tokenizer.onerror.subscribe(err => { console.error("FOUND TOKENIZER ERROR", err.message) })
tokenizer.write(data)
tokenizer.end()
