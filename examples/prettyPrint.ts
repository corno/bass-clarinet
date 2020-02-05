import { Parser } from "../src/Parser"
import * as sp from "../src/subscribeStack"

const test = `
{ // 1:1
    "glossary": { // 2:21-30 2:33
            "title": "example glossary", //3:29-35 3:38-55
            "GlossDiv": { // 4:21-30 4:33
                    "title": "S", //5:37-43 5:46-48
                    "GlossList": { // 6:25-35 6:38
                            "GlossEntry": { // 7:45-56 7:59
                                    "ID": "SGML", //8:53-56 8:59-64
                                    "SortAs": "SGML", //9:33-40 9:43-48
                                    "GlossTerm": "Standard Generalized Markup Language", //10:33-43 10:46-83
                                    "Acronym": "SGML", //11:33-41 11:44-49
                                    "Abbrev": "ISO 8879:1986", //12:33-40 12:43-57
                                    "GlossDef": { // 13:33-42 13:45
                                            "para": "A meta-markup language, used to create markup languages such as DocBook.", //14:61-66 14:69-142
                                            "GlossSeeAlso": [ // 15:37-50 15:53
                                                    "GML", // 15:54-58
                                                    "XML", // 15:61-65
                                            ], // "GlossSeeAlso" 15:66
                                    }, // "GlossDef" 16:53
                                    "GlossSee": "markup", //17:33-42 17:45-52
                            }, // "GlossEntry" 18:45
                    }, // "GlossList" 19:37
            }, // "GlossDiv" 20:29
    }, // "glossary" 21:21
} // 22:13
`
function format(value: number | string | boolean | null) {
    if (typeof value === "string") {
        return `"${JSON.stringify(value)}"`
    } else {
        return value
    }
}

export function createPropertiesPrettyPrinter(indentation: string, callback: (str: string) => void): sp.PropertySubscribers {
    let suffix = ""
    return {
        array: (key, ac) => {
            callback(`${suffix}${indentation}"${key}": [`)
            ac.onElement(createValuesPrettyPrinter(`${indentation}\t`, callback))
            ac.onEnd(() => {
                callback(`${indentation}]`)
                suffix = ", "
            })
        },
        object: (key, oc) => {
            callback(`${suffix}${indentation}"${key}": {`)
            oc.onProperty(createPropertiesPrettyPrinter(`${indentation}\t`, callback))
            oc.onEnd(() => {
                callback(`${indentation}}`)
                suffix = ", "
            })
        },
        value: (key, value) => {
            callback(`${suffix}${indentation}"${key}": ${format(value)}`)
            suffix = ", "
        },
    }
}

export function createValuesPrettyPrinter(indentation: string, callback: (str: string) => void): sp.ValueSubscribers {
    let suffix = ""
    return {
        array: (ac) => {
            callback(`${suffix}${indentation}[`)
            ac.onElement(createValuesPrettyPrinter(`${indentation}\t`, callback))
            ac.onEnd(() => {
                callback(`${indentation}]`)
                suffix = ", "

            })
        },
        object: (oc) => {
            callback(`${suffix}${indentation}{`)
            oc.onProperty(createPropertiesPrettyPrinter(`${indentation}\t`, callback))
            oc.onEnd(() => {
                callback(`${indentation}}`)
                suffix = ", "

            })
        },
        value: (value) => {
            callback(`${suffix}${indentation}${format(value)}`)
            suffix = ", "
        },
    }
}

const parser = new Parser({ allow_comments: true, allow_trailing_commas: true})
sp.subscribeStack(parser, createValuesPrettyPrinter("\r\n", str => process.stdout.write(str)))
parser.write(test)
parser.end()


