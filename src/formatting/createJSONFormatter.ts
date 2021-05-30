import { Annotater } from "../attachments/createDecorator"
import { StackContext } from "../handlers"
import { NonTokenFormatInstruction, TokenFormatInstruction } from "./FormatInstruction"
import { createSerializedNonWrappedString, createSerializedQuotedString } from "./escapeString"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

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
                token: createSerializedQuotedString($.propertyData.key),
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
                token: ((): string => {

                    switch ($.data.type[0]) {
                        case "multiline": {
                            const $$ = $.data.type[1]
                            return createSerializedQuotedString(
                                $$.lines.join(newline),
                            )
                        }
                        case "nonwrapped": {
                            const $$ = $.data.type[1]
                            if ($$.value === "true" || $$.value === "false" || $$.value === "null") {
                                return $$.value
                            }
                            //eslint-disable-next-line
                            const nr = new Number($$.value).valueOf()
                            if (isNaN(nr)) {
                                return createSerializedQuotedString($$.value)
                            }
                            return createSerializedNonWrappedString($$.value)
                        }
                        case "quoted": {
                            const $$ = $.data.type[1]
                            return createSerializedQuotedString($$.value)
                        }
                        default:
                            return assertUnreachable($.data.type[0])
                    }
                })(),
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
                token: createSerializedQuotedString($.data.option),
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

