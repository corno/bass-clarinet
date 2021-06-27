import * as p from "pareto"
import * as core from "astn-core"
import {
    createStructureParser, printStructureError, StructureErrorType,
} from "../structureParser"
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
import { TokenizerAnnotationData } from "../../interfaces"
import { TokenError, printPreTokenizerError } from "../pretokenizer"
import { printTreeParserError, TreeParserError } from "../treeParser"
import { SimpleStringData } from "astn-core"

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
            callback(`${printStructureError($.error)}${printRange2($.annotation.range)}`)
        },
        onTreeParserError: $ => {
            callback(`${printTreeParserError($.error)}${printRange2($.annotation.range)}`)
        },
    }
}

export type ErrorStreamsHandler = {
    onTokenizerError: ($: {
        error: TokenError
        range: Range
    }) => void
    onTextParserError: ($: {
        error: StructureErrorType
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
    onEmbeddedSchema: (schemaSchemaName: string) => core.ITreeBuilder<TokenizerAnnotationData, null, null>,
    onSchemaReference: (token: SimpleStringData, tokenAnnotation: TokenizerAnnotationData) => void,
    onInstanceDataStart: (annotation: TokenizerAnnotationData) => core.ITreeBuilder<TokenizerAnnotationData, ReturnType, ErrorType>,
    errorStreams: ErrorStreamsHandler
): p.IUnsafeStreamConsumer<string, null, ReturnType, ErrorType> {
    return createStreamPreTokenizer(
        createTokenizer(
            createStructureParser(
                onEmbeddedSchema,
                onSchemaReference,
                onInstanceDataStart,
                errorStreams.onTextParserError,
                errorStreams.onTreeParserError,
            ),
        ),
        errorStreams.onTokenizerError,
    )
}