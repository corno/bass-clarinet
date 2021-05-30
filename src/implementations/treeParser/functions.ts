import { ITreeParser } from "../../interfaces/ITreeParser";
import { ITreeParserEventConsumer } from "../../interfaces/ITreeParserEventConsumer";
import {  Range } from "../../location"


export type TreeParserErrorType =
    | ["unexpected end of document", {
        "still in":
        | ["array"]
        | ["object"]
        | ["tagged union"]
    }]
    | ["unexpected '!'"]
    | ["not in an object"]
    | ["not in an array"]
    | ["missing property value"]
    | ["expected option"]
    | ["unknown punctuation", {
        found: string
    }]

export type TreeParserError = {
    type: TreeParserErrorType
}

export type CreateTreeParser<ReturnType, ErrorType> = (
    onerror: (error: TreeParserError, range: Range) => void,
    eventsConsumer: ITreeParserEventConsumer<ReturnType, ErrorType>
) => ITreeParser<ReturnType, ErrorType>