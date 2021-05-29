import { Annotater } from "../attachments/createDecorator"
import { StackContext } from "../handlers"
import { NonTokenFormatInstruction, TokenFormatInstruction } from "./FormatInstruction"
import { createApostrophedString, createBacktickedString, createNonQuotedString, createQuotedString } from "./escapeString"


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function createASTNFormatter<TokenAnnotation, NonTokenAnnotation>(
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
        objectBegin: $ => {
            return {
                stringBefore: ``,
                token: `${$.data.type[0] === "verbose type" ? "(": "{"}`,
                stringAfter: ``,
            }
        },
        property: $ => {
            return {
                stringBefore: `${newline}${createIndentation($.stackContext)}${indentationString}`,
                token: ((): string => {
                    switch ($.objectData.type[0]) {
                        case "verbose type": {
                            return createApostrophedString($.propertyData.key)
                        }
                        case "dictionary": {
                            return createQuotedString($.propertyData.key)
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
                token: `${$.data.type[0] === "verbose type" ? ")": "}"}`,
                stringAfter: ``,
            }
        },

        arrayBegin: $ => {
            return {
                stringBefore: ``,
                token: `${$.data.type[0] === "shorthand type" ? "<": "["}`,
                stringAfter: ``,
            }
        },
        element: () => {
            return {
                string: ` `,
            }
        },
        arrayEnd: $ => {
            return {
                stringBefore: ` `,
                token: `${$.data.type[0] === "shorthand type" ? ">": "]"}`,
                stringAfter: ``,
            }
        },

        simpleValue: $ => {
            return {
                stringBefore: ``,
                token: ((): string => {
                    switch ($.data.wrapper[0]) {
                        case "backtick": {
                            return createBacktickedString($.data.value)
                        }
                        case "none": {
                            return createNonQuotedString($.data.value)
                        }
                        case "quote": {
                            return createQuotedString($.data.value)
                        }
                        default:
                            return assertUnreachable($.data.wrapper[0])
                    }
                })(),
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
                token: createApostrophedString($.data.option),
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
