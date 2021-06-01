import * as core from "astn-core"
import { ITreeParser } from "../../interfaces/ITreeParser";
import {  Range } from "../../generic/location"


export type TreeParserErrorType =
    | ["unexpected end of document", {
        "still in":
        | ["array"]
        | ["object"]
        | ["tagged union"]
    }]
    | ["unexpected '!'"]
    | ["invalid dictionary close"]
    | ["invalid verbose type close"]
    | ["invalid list close"]
    | ["invalid shorthand type close"]
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

export type CreateTreeParser<Annotation, ReturnType, ErrorType> = (
    onerror: (error: TreeParserError, range: Range) => void,
    eventsConsumer: core.ITreeBuilder<Annotation, ReturnType, ErrorType>
) => ITreeParser<ReturnType, ErrorType>