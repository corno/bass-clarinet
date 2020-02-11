import * as fs  from "fs"
import { Parser, lax } from "../src/Parser"
import * as sp from "../src/subscribeStack"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, {encoding: "utf-8"})

function format(value: number | string | boolean | null) {
    if (typeof value === "string") {
        return `${JSON.stringify(value)}`
    } else {
        return value
    }
}


export function createValuesPrettyPrinter(indentation: string, writer: (str: string) => void): sp.ValueHandler {
    return {
        array: (_location, openCharacter) => {
            writer(openCharacter)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                end: ((_location, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                })
            }

        },
        object: (_location, openCharacter) => {
            writer(openCharacter)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}\t"${key}": `)
                    return createValuesPrettyPrinter(`${indentation}\t`, writer)
                },
                end: (_location, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                }
            }
        },
        simpleValue: (value) => {
            writer(`${format(value)}`)
        },
        null: () => {
            writer(`null`)
        },
        typedUnion: (option, _unionStart, _optionRange) => {
            writer(`| "${option}" `)
            return createValuesPrettyPrinter(`${indentation}`, writer)
        },
    }
}

function createPrettyPrinter(indentation: string, writer: (str: string) => void): sp.RootHandler {
    return {
        value: createValuesPrettyPrinter(indentation, writer),
        endComments: () => {}
    }
}

const parser = new Parser({ allow: lax})
sp.subscribeStack(parser, createPrettyPrinter("\r\n", str => process.stdout.write(str)), err => { console.error("FOUND ERROR", err.message) })
parser.write(data)
parser.end()
