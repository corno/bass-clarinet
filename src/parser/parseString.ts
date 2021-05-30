import * as p from "pareto"
import * as p20 from "pareto-20"
import {
    Range,
    Location,
} from "../location"
import {
    createParserStack, ParsingError,
} from "./createParserStack"
import { ITreeParserEventConsumer } from "../interfaces/ITreeParserEventConsumer"
import { OverheadToken } from "../interfaces/ITreeParser"

export function parseString<ReturnType, ErrorType>(
    data: string,
    onSchemaDataStart: (range: Range) => ITreeParserEventConsumer<null, null>,
    onInstanceDataStart: (location: Location) => ITreeParserEventConsumer<ReturnType, ErrorType>,
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