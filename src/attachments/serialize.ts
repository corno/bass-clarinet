import * as fp from "fountain-pen"
import * as p from "pareto"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export interface IInDictionary<T> {
    isEmpty(): boolean
    map<R>(callback: (property: T, key: string) => R): IInArray<R>
}
export interface IInArray<T> extends fp.IInArray<T> {
    isEmpty(): boolean
    map<R>(callback: (element: T) => R): IInArray<R>
}

export type Properties = IInDictionary<Value>

export type Value =
    | ["simple value", {
        quote: string | null
        value: string
    }]
    | ["array", {
        elements: Value[]
        openCharacter: string
    }]
    | ["object", {
        properties: Properties
        openCharacter: string
    }]
    | ["tagged union", {
        option: string
        data: Value
    }]

export type Document = {
    schema: null | Value
    compact: boolean
    root: Value
}

function writeValue(value: Value): fp.InlineSegment {
    switch (value[0]) {
        case "array": {
            const $ = value[1]
            if ($.elements.length === 0) {
                return $.openCharacter === "<" ? `< >` : `[ ]`
            }
            return [
                $.openCharacter === "<" ? `<` : `[`,
                () => {
                    return $.elements.map(element => {
                        return fp.line(writeValue(element))
                    })
                },
                $.openCharacter === "<" ? `>` : `]`,
            ]
        }
        case "object": {
            const $ = value[1]
            if ($.properties.isEmpty()) {
                return $.openCharacter === "(" ? `( )` : `{ }`
            }
            const quote = $.openCharacter === "(" ? `'` : `"`
            return [
                $.openCharacter === "(" ? `(` : `{`,
                () => {
                    return $.properties.map((property, propertyName) => {
                        return fp.line([
                            `${quote}${propertyName}${quote}: `,
                            writeValue(property),
                        ])
                    })
                },
                $.openCharacter === "(" ? `)` : `}`,
            ]
        }
        case "simple value": {
            const $ = value[1]
            if ($.quote === null) {
                return $.value
            }
            return JSON.stringify($.value)
        }
        case "tagged union": {
            const $ = value[1]
            return [
                `| '${$.option}' `,
                writeValue($.data),
            ]
        }
        default:
            return assertUnreachable(value[0])
    }
}

export function serializeDocument(
    document: Document,
    indentation: string,
    trimEndWhitespace: boolean,
): p.IStream<string, null> {
    return fp.serializeToStream(
        fp.line([
            document.schema === null
                ? ``
                : [
                    `! `,
                    writeValue(document.schema),
                    ` `,
                ],
            document.compact ? `# ` : ``,
            writeValue(document.root),
        ]),
        indentation,
        trimEndWhitespace,
    )
}

