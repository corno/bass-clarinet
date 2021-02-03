import * as fp from "fountain-pen"
import * as p from "pareto"
import {
    SerializableBeforeCommentData,
    SerializableDocument,
    SerializableValue,
} from "./Serializable"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

function writeCommentsBefore(before: SerializableBeforeCommentData): fp.InlineSegment {
    return [
        before.comments.map(cb => {
            return "/*" + cb.text + "*/"
        }),
    ]
}
function writeCommentAfter(commentAfter: null | string): fp.InlineSegment {
    return commentAfter === null ? null : ` //${commentAfter}`
}

function writeValue(value: SerializableValue): fp.InlineSegment {
    return [
        writeCommentsBefore(value.commentData.before),
        ((): fp.InlineSegment => {
            switch (value.type[0]) {
                case "array": {
                    const $ = value.type[1]
                    return [
                        writeCommentsBefore($.commentData.before),
                        $.elements.isEmpty()
                            ? $.openCharacter === "<" ? `< >` : `[ ]`
                            :
                            [
                                $.openCharacter === "<" ? `<` : `[`,
                                () => {
                                    return $.elements.map(element => {
                                        return fp.line(writeValue(element))
                                    })
                                },
                                $.openCharacter === "<" ? `>` : `]`,
                            ],
                        writeCommentAfter($.commentData.lineCommentAfter),
                    ]
                }
                case "object": {
                    const $ = value.type[1]
                    const quote = $.openCharacter === "(" ? `'` : `"`
                    return [
                        writeCommentsBefore($.commentData.before),
                        $.properties.isEmpty()
                            ? $.openCharacter === "(" ? `( )` : `{ }`
                            : [
                                $.openCharacter === "(" ? `(` : `{`,
                                () => {
                                    return $.properties.map((property, propertyName) => {
                                        return [
                                            writeCommentsBefore(property.commentData.before),
                                            fp.line([
                                                `${quote}${propertyName}${quote}: `,
                                                writeValue(property.value),
                                            ]),
                                            writeCommentAfter(property.commentData.lineCommentAfter),
                                        ]
                                    })
                                },
                                $.openCharacter === "(" ? `)` : `}`,
                            ],
                        writeCommentAfter($.commentData.lineCommentAfter),
                    ]
                }
                case "simple value": {
                    const $ = value.type[1]
                    if ($.quote === null) {
                        return $.value
                    }
                    return JSON.stringify($.value)
                }
                case "tagged union": {
                    const $ = value.type[1]

                    return [
                        writeCommentsBefore($.commentData.before),
                        `| '${$.option}' `,
                        writeValue($.data),
                        writeCommentAfter($.commentData.lineCommentAfter),
                    ]
                }
                default:
                    return assertUnreachable(value.type[0])
            }
        })(),
        writeCommentAfter(value.commentData.lineCommentAfter),
    ]

}

export function serializeDocument(
    document: SerializableDocument,
    indentation: string,
    trimEndWhitespace: boolean,
    newline: string,
): p.IStream<string, null> {
    return fp.serializeToStream(
        [
            document.documentComments.map(dc => {
                return "/*" + dc.text + "*/"
            }),
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
        ],
        indentation,
        trimEndWhitespace,
        newline,
    )
}

