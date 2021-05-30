import { Annotater } from "../createDecorator"
import {  StackContext } from "../handlers"
import { NonTokenFormatInstruction, TokenFormatInstruction } from "./FormatInstruction"
import { createSerializedApostrophedString, createSerializedQuotedString } from "./escapeString"
import { createSerializedString } from "./createSerializedASTNString"


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function createASTNFormatter<TokenAnnotation, NonTokenAnnotation>(
    indentationString: string,
    newline: string,
): Annotater<TokenAnnotation, NonTokenAnnotation, TokenFormatInstruction, NonTokenFormatInstruction> {

    function createIndentation(context: StackContext) {
        let indentation = ``
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
                stringBefore: `${newline}${createIndentation($.stackContext)}${indentationString}`,
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
                stringBefore: $.isEmpty ? ` ` : `${newline}${createIndentation($.stackContext)}`,
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
                    : `${newline}${createIndentation($.stackContext)}${indentationString}`,
            }
        },
        arrayEnd: $ => {
            return {
                stringBefore: $.data.type[0] === "shorthand type"
                    ? ` `
                    : $.isEmpty ? ` ` : `${newline}${createIndentation($.stackContext)}`,
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
                    newline,
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
