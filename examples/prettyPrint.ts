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
        return `"${JSON.stringify(value)}"`
    } else {
        return value
    }
}


export function createValuesPrettyPrinter(indentation: string, callback: (str: string) => void): sp.ValueHandler {
    let suffix = ""
    return {
        array: (_location) => {
            callback(`${suffix}${indentation}[`)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, callback),
                end: (() => {
                    callback(`${indentation}]`)
                    suffix = ", "
                })
            }

        },
        object: (_location) => {
            callback(`${suffix}${indentation}{`)
            return {
                property: (key, _keyRange) => {
                    callback(`${suffix}${indentation}"${key}": `)
                    return createValuesPrettyPrinter(`${indentation}\t`, callback)
                },
                end: () => {
                    callback(`${indentation}]`)
                    suffix = ", "
                }
            }
        },
        value: (value) => {
            callback(`${suffix}${indentation}${format(value)}`)
            suffix = ", "
        },
        typedunion: (option, _unionStart, _optionRange) => {
            callback(`${suffix}${indentation}| "${option}"`)
            suffix = ", "
            return createValuesPrettyPrinter(`${indentation}\t`, callback)
        },
    }
}

const parser = new Parser({ allow: lax})
sp.subscribeStack(parser, createValuesPrettyPrinter("\r\n", str => process.stdout.write(str)))
parser.write(data)
parser.end()


