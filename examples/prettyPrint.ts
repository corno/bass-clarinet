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


export function createValuesPrettyPrinter(indentation: string, callback: (str: string) => void): sp.ValueHandler {
    return {
        array: (_location, openCharacter) => {
            callback(openCharacter)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, callback),
                end: ((_location, endCharacter) => {
                    callback(`${indentation}${endCharacter}`)
                })
            }

        },
        object: (_location, openCharacter) => {
            callback(openCharacter)
            return {
                property: (key, _keyRange) => {
                    callback(`${indentation}\t"${key}": `)
                    return createValuesPrettyPrinter(`${indentation}\t`, callback)
                },
                end: (_location, endCharacter) => {
                    callback(`${indentation}${endCharacter}`)
                }
            }
        },
        value: (value) => {
            callback(`${format(value)}`)
        },
        typedunion: (option, _unionStart, _optionRange) => {
            callback(`| "${option}" `)
            return createValuesPrettyPrinter(`${indentation}`, callback)
        },
    }
}

const parser = new Parser({ allow: lax})
sp.subscribeStack(parser, createValuesPrettyPrinter("\r\n", str => process.stdout.write(str)), err => { console.error("FOUND ERROR", err.message) })
parser.write(data)
parser.end()


