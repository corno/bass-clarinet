import * as p from "pareto"
import * as core from "astn-core"
import {
    createTextParser,
} from "../textParser"
import {
    Range,
} from "../../generic/location"
import {
    createStreamPreTokenizer,
} from "../streamPretokenizer"
import {
    createTokenizer,
} from "../tokenizer"
import { printPreTokenizerError, PreTokenizerError } from "../pretokenizer"
import { printTextParserError } from "../textParser"
import { TextParserError } from "../textParser"
import { Token } from "../../interfaces/ITreeParser"
import { TokenizerAnnotationData } from "../../interfaces"

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
 * @param onSchemaDataStart a callback that should provide a handler for the (optional) schema part of the text
 * @param onInstanceDataStart a callback that must provide a handler for the instance data part of the text
 * @param onTokenizerError an optional callback for when a tokenizer error occurs.
 * @param onParserError an optional callback for when a parser error occurs.
 * @param onHeaderOverheadToken an optional callback for handling overhead tokens in the header (comments, whitespace, newlines).
 */
export function createParserStack<ReturnType, ErrorType>(
    onSchemaDataStart: (startToken: Token<TokenizerAnnotationData>) => core.ITreeBuilder<TokenizerAnnotationData, null, null>,
    onInstanceDataStart: (annotation: TokenizerAnnotationData) => core.ITreeBuilder<TokenizerAnnotationData, ReturnType, ErrorType>,
    onError: (error: ParsingError, range: Range) => void = () => {
        //
    },
): p.IUnsafeStreamConsumer<string, null, ReturnType, ErrorType> {
    return createStreamPreTokenizer(
        createTokenizer(createTextParser(
            onSchemaDataStart,
            onInstanceDataStart,
            (error, annotation) => {
                onError(
                    {
                        source: ["parser", error],
                    },
                    annotation.range,
                )
            },
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