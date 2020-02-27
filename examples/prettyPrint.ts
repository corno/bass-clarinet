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

export function attachPrettyPrinter(parser: bc.Parser, indentation: string, writer: (str: string) => void) {
    bc.attachStackedDataSubscriber(
        parser,
        createValuesPrettyPrinter(indentation, writer),
        error => {
            console.error("FOUND STACKED DATA ERROR", error.message)
        },
        _comments => {
            //onEnd
        }
    )
}


const prsr = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
    { allow: bc.lax }
)

attachPrettyPrinter(prsr, "\r\n", str => process.stdout.write(str))

bc.tokenizeString(
    prsr,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    data
)
