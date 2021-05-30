import * as p from "pareto"
import {
    createTextParser,
} from "../implementations/textParser"
import {
    Range,
    Location,
} from "../location"
import {
    createStreamPreTokenizer,
} from "../implementations/streamPretokenizer"
import {
    createTokenizer,
} from "../implementations/tokenizer"
import { printPreTokenizerError, PreTokenizerError } from "../implementations/pretokenizer"
import { TreeParserEventConsumer } from "../implementations/treeParser"
import { printTextParserError } from "../implementations/textParser"
import { TextParserError } from "../implementations/textParser"
import { OverheadToken } from "../interfaces/ITreeParser"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export type ParsingError = {
    source:
    | ["parser", TextParserError]
    | ["tokenizer", PreTokenizerError]
}

export function printParsingError(error: ParsingError): string {

    switch (error.source[0]) {
        case "parser": {
            const $ = error.source[1]
            return printTextParserError($)
        }
        case "tokenizer": {
            const $ = error.source[1]
            return printPreTokenizerError($)
        }
        default:
            return assertUnreachable(error.source[0])
    }
}

/**
 * the top level function for this package.
 * @param onSchemaDataStart a callback that should provide a handler for the (optional) schema part of the document
 * @param onInstanceDataStart a callback that must provide a handler for the instance data part of the document
 * @param onTokenizerError an optional callback for when a tokenizer error occurs.
 * @param onParserError an optional callback for when a parser error occurs.
 * @param onHeaderOverheadToken an optional callback for handling overhead tokens in the header (comments, whitespace, newlines).
 */
export function createParserStack<ReturnType, ErrorType>(
    onSchemaDataStart: (range: Range) => TreeParserEventConsumer<null, null>,
    onInstanceDataStart: (location: Location) => TreeParserEventConsumer<ReturnType, ErrorType>,
    onError: (error: ParsingError, range: Range) => void = () => {
        //
    },
    onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean> = () => p.value(false),
): p.IUnsafeStreamConsumer<string, null, ReturnType, ErrorType> {
    return createStreamPreTokenizer(
        createTokenizer(createTextParser(
            onSchemaDataStart,
            onInstanceDataStart,
            (error, range) => {
                onError(
                    {
                        source: ["parser", error],
                    },
                    range,
                )
            },
            onHeaderOverheadToken,
        )),
        $ => {
            onError(
                {
                    source: ["tokenizer", $.error],
                },
                $.range,
            )
        },
    )
}