import { Annotater } from "../attachments/createDecorator"
import { StackContext } from "../handlers"
import { NonTokenFormatInstruction, TokenFormatInstruction } from "./FormatInstruction"
import { createQuotedString } from "./escapeString"

export function createJSONFormatter<TokenAnnotation, NonTokenAnnotation>(
    indentationString: string,
    newline: string,
): Annotater<TokenAnnotation, NonTokenAnnotation, TokenFormatInstruction, NonTokenFormatInstruction> {

    function createIndentation(context: StackContext) {
        let indentation = ``
        for (let i = 0; i !== context.dictionaryDepth + context.verboseTypeDepth; i += 1) {
            indentation += indentationString
        }
        return indentation
    }
    return {
        objectBegin: () => {
            return {
                stringBefore: ``,
                token: `{`,
                stringAfter: ``,
            }
        },
        property: $ => {
            return {
                stringBefore: `${$.isFirst ? "" : ","}${newline}${createIndentation($.stackContext)}${indentationString}`,
                token: createQuotedString($.propertyData.key),
                stringAfter: `: `,
            }
        },
        objectEnd: $ => {
            return {
                stringBefore: $.isEmpty ? ` ` : `${newline}${createIndentation($.stackContext)}`,
                token: `}`,
                stringAfter: ``,
            }
        },

        arrayBegin: () => {
            return {
                stringBefore: ``,
                token: `[`,
                stringAfter: ``,
            }
        },
        element: $ => {
            return {
                string: `${$.isFirst ? "" : ","} `,
            }
        },
        arrayEnd: () => {
            return {
                stringBefore: ` `,
                token: `]`,
                stringAfter: ``,
            }
        },

        simpleValue: $ => {
            return {
                stringBefore: ``,
                token: createQuotedString($.data.value),
                stringAfter: ``,
            }
        },

        taggedUnionBegin: () => {
            return {
                stringBefore: ``,
                token: `[`,
                stringAfter: ``,
            }
        },
        option: $ => {
            return {
                stringBefore: ` `,
                token: createQuotedString($.data.option),
                stringAfter: `, `,
            }
        },
        taggedUnionEnd: () => {
            return {
                string: ` ]`,
            }
        },
    }
}

