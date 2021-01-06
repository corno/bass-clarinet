import * as p from "pareto"
import * as p20 from "pareto-20"
import {
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

export function parseString<ReturnType, ErrorType>(
    data: string,
    onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
    onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
    onTokenizerError: (message: string, range: Range) => void = () => {
        //
    },
    onParserError: (message: string, range: Range) => void = () => {
        //
    },
    onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean> = () => p.result(false),
): p.IUnsafeValue<ReturnType, ErrorType> {
    return p20.createArray([data]).streamify().toUnsafeValue(
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