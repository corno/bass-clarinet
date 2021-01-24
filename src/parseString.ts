import * as p from "pareto"
import * as p20 from "pareto-20"
import {
    ParserError,
    ParserEventConsumer,
} from "./createParser"
import {
    OverheadToken,
} from "./Token"
import {
    Range,
    Location,
} from "./location"
import {
    createParserStack,
} from "./createParserStack"
import { PreTokenizerError } from "./PreTokenizer"

export function parseString<ReturnType, ErrorType>(
    data: string,
    onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
    onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
    onTokenizerError: (error: PreTokenizerError, range: Range) => void = () => {
        //
    },
    onParserError: (error: ParserError, range: Range) => void = () => {
        //
    },
    onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean> = () => p.result(false),
): p.IUnsafeValue<ReturnType, ErrorType> {
    return p20.createArray([data]).streamify().consume(
        null,
        createParserStack(
            onSchemaDataStart,
            onInstanceDataStart,
            onTokenizerError,
            onParserError,
            onHeaderOverheadToken,
        )
    )
}