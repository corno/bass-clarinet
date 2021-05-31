import { Annotater } from "../interfaces/IAnnotater"
import { StackContext } from "../interfaces/handlers"
import { NonTokenFormatInstruction, TokenFormatInstruction } from "./FormatInstruction"
import { createSerializedApostrophedString, createSerializedQuotedString } from "./escapeString"
import { createSerializedString } from "./createSerializedASTNString"
import { Formatter } from "./Formatter"


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}


export function createASTNNormalizer<TokenAnnotation, NonTokenAnnotation>(
    indentationString: string,
    newline: string,
): Formatter<TokenAnnotation, NonTokenAnnotation> {
    return {
        onSchemaHeader: () => {
            return "! "
        },
        schemaFormatter: createASTNNormalizer2(indentationString, newline),
        bodyFormatter: createASTNNormalizer2(indentationString, newline),
    }

}

function createASTNNormalizer2<TokenAnnotation, NonTokenAnnotation>(
    indentationString: string,
    newline: string,
): Annotater<TokenAnnotation, NonTokenAnnotation, TokenFormatInstruction, NonTokenFormatInstruction> {

    function createIndentation(context: StackContext) {
        let indentation = newline
        for (let i = 0; i !== context.dictionaryDepth + context.verboseTypeDepth + + context.listDepth; i += 1) {
            indentation += indentationString
        }
        return indentation
    }
    return {
        objectBegin: $ => {
            return {
                stringBefore: ``,
                token: `${$.data.type[0] === "verbose type" ? "(" : "{"}`,
                stringAfter: ``,
            }
        },
        property: $ => {
            return {
                stringBefore: `${createIndentation($.stackContext)}${indentationString}`,
                token: ((): string => {
                    switch ($.objectData.type[0]) {
                        case "verbose type": {
                            return createSerializedApostrophedString($.propertyData.key)
                        }
                        case "dictionary": {
                            return createSerializedQuotedString($.propertyData.key)
                        }
                        default:
                            return assertUnreachable($.objectData.type[0])
                    }
                })(),
                stringAfter: `: `,
            }
        },
        objectEnd: $ => {
            return {
                stringBefore: $.isEmpty ? ` ` : `${createIndentation($.stackContext)}`,
                token: `${$.data.type[0] === "verbose type" ? ")" : "}"}`,
                stringAfter: ``,
            }
        },

        arrayBegin: $ => {
            return {
                stringBefore: ``,
                token: `${$.data.type[0] === "shorthand type" ? "<" : "["}`,
                stringAfter: ``,
            }
        },
        element: $ => {
            return {
                string: $.arrayData.type[0] === "shorthand type"
                    ? ` `
                    : `${createIndentation($.stackContext)}${indentationString}`,
            }
        },
        arrayEnd: $ => {
            return {
                stringBefore: $.data.type[0] === "shorthand type"
                    ? ` `
                    : $.isEmpty ? ` ` : `${createIndentation($.stackContext)}`,
                token: $.data.type[0] === "shorthand type"
                    ? `>`
                    : `]`,
                stringAfter: ``,
            }
        },

        stringValue: $ => {
            return {
                stringBefore: ``,
                token: createSerializedString(
                    $.data,
                    createIndentation($.stackContext),
                ),
                stringAfter: ``,
            }
        },

        taggedUnionBegin: () => {
            return {
                stringBefore: ``,
                token: `|`,
                stringAfter: ` `,
            }
        },
        option: $ => {
            return {
                stringBefore: ``,
                token: createSerializedApostrophedString($.data.option),
                stringAfter: ` `,
            }
        },
        taggedUnionEnd: () => {
            return {
                string: ``,
            }
        },
    }
}
