import * as p from "pareto"
import * as p20 from "pareto-20"
import {
    TextParserEventConsumer,
} from "./TextParserEventConsumer"
import {
    OverheadToken,
} from "./Token"
import {
    Range,
    Location,
} from "./location"
import {
    createParserStack, ParsingError,
} from "./createParserStack"

export function parseString<ReturnType, ErrorType>(
    data: string,
    onSchemaDataStart: (range: Range) => TextParserEventConsumer<null, null>,
    onInstanceDataStart: (location: Location) => TextParserEventConsumer<ReturnType, ErrorType>,
    onError: (error: ParsingError, range: Range) => void = () => {
        //
    },
    onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean> = () => p.value(false),
): p.IUnsafeValue<ReturnType, ErrorType> {
    return p20.createArray([data]).streamify().tryToConsume(
        null,
        createParserStack(
            onSchemaDataStart,
            onInstanceDataStart,
            onError,
            onHeaderOverheadToken,
        )
    )
}