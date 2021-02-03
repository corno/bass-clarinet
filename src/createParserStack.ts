import * as p from "pareto"
import {
    ParserEventConsumer,
    createParser,
    ParserError,
    printParserError,
} from "./createParser"
import {
    OverheadToken,
} from "./Token"
import {
    Range,
    Location,
} from "./location"
import {
    createStreamPreTokenizer,
} from "./createStreamPreTokenizer"
import {
    createTokenizer,
} from "./createTokenizer"
import { printPreTokenizerError, PreTokenizerError } from "./PreTokenizer"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export type ParsingError = {
    source:
    | ["parser", ParserError]
    | ["tokenizer", PreTokenizerError]
}

export function printParsingError(error: ParsingError): string {

    switch (error.source[0]) {
        case "parser": {
            const $ = error.source[1]
            return printParserError($)
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
    onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
    onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
    onError: (error: ParsingError, range: Range) => void = () => {
        //
    },
    onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean> = () => p.result(false),
): p.IUnsafeStreamConsumer<string, null, ReturnType, ErrorType> {
    return createStreamPreTokenizer(
        createTokenizer(createParser(
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
        (error, range) => {
            onError(
                {
                    source: ["tokenizer", error],
                },
                range,
            )
        },
    )
}