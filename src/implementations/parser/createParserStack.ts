import * as p from "pareto"
import * as core from "astn-core"
import {
    createTextParser, printTextParserError, TextErrorType,
} from "../textParser"
import {
    printRange,
    Range,
} from "../../generic/location"
import {
    createStreamPreTokenizer,
} from "../streamPretokenizer"
import {
    createTokenizer,
} from "../tokenizer"
import { Token } from "../../interfaces/ITreeParser"
import { TokenizerAnnotationData } from "../../interfaces"
import { PreTokenizerError, printPreTokenizerError } from "../pretokenizer"
import { printTreeParserError, TreeParserError } from "../treeParser"

export function createErrorStreamHandler(withRange: boolean, callback: (stringifiedError: string) => void): ErrorStreamsHandler {
    function printRange2(range: Range) {
        if (!withRange) {
            return ""
        }
        return ` @ ${printRange(range)}`
    }
    return {
        onTokenizerError: $ => {
            callback(`${printPreTokenizerError($.error)}${printRange2($.range)}`)
        },
        onTextParserError: $ => {
            callback(`${printTextParserError($.error)}${printRange2($.annotation.range)}`)
        },
        onTreeParserError: $ => {
            callback(`${printTreeParserError($.error)}${printRange2($.annotation.range)}`)
        },
    }
}

export type ErrorStreamsHandler = {
    onTokenizerError: ($: {
        error: PreTokenizerError
        range: Range
    }) => void
    onTextParserError: ($: {
        error: TextErrorType
        annotation: TokenizerAnnotationData
    }) => void
    onTreeParserError: ($: {
        error: TreeParserError
        annotation: TokenizerAnnotationData
    }) => void
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
    errorStreams: ErrorStreamsHandler
): p.IUnsafeStreamConsumer<string, null, ReturnType, ErrorType> {
    return createStreamPreTokenizer(
        createTokenizer(createTextParser(
            onSchemaDataStart,
            onInstanceDataStart,
            errorStreams.onTextParserError,
            errorStreams.onTreeParserError,
        )),
        errorStreams.onTokenizerError,
    )
}