import * as p from "pareto"
import * as astn from ".."
import { NonTokenFormatInstruction, TokenFormatInstruction } from "./FormatInstruction"

function writeToken(
    writer: (str: string) => void,
    instruction: TokenFormatInstruction,
) {
    writer(instruction.stringBefore)
    writer(instruction.token)
    writer(instruction.stringAfter)
}
function writeNonToken(
    writer: (str: string) => void,
    instruction: NonTokenFormatInstruction,
) {
    writer(instruction.string)
}

function createValueConcatenator(
    writer: (str: string) => void
): astn.ValueHandler<TokenFormatInstruction, NonTokenFormatInstruction> {
    return {
        array: $ => {
            writeToken(writer, $.annotation)
            return {
                element: $ => {
                    writeNonToken(writer, $.annotation)
                    return createValueConcatenator(writer)
                },
                arrayEnd: $ => {
                    writeToken(writer, $.annotation)
                    return p.value(null)
                },
            }

        },
        object: $ => {
            writeToken(writer, $.annotation)
            return {
                property: $ => {
                    writeToken(writer, $.annotation)
                    return p.value(createRequiredValueConcatenator(writer))
                },
                objectEnd: $$ => {
                    writeToken(writer, $$.annotation)
                    return p.value(null)
                },
            }
        },
        simpleValue: $ => {
            writeToken(writer, $.annotation)
            return p.value(false)
        },
        taggedUnion: $ => {
            writeToken(writer, $.annotation)
            return {
                option: $ => {
                    writeToken(writer, $.annotation)
                    return createRequiredValueConcatenator(writer)
                },
                missingOption: () => {
                    //
                },
                end: $ => {
                    writeNonToken(writer, $.annotation)
                },
            }
        },
    }
}

export function createRequiredValueConcatenator(
    writer: (str: string) => void
): astn.RequiredValueHandler<TokenFormatInstruction, NonTokenFormatInstruction> {
    return {
        exists: createValueConcatenator(writer),
        missing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}
