import { TreeParserError } from "../treeParser";

export type TextErrorType =
    | ["expected the schema start (!) or root value"]
    | ["expected the schema"]
    | ["expected rootvalue"]
    | ["unexpected data after end", {
        data: string
    }]

export type TextParserError = {
    type:
    | ["body", TreeParserError]
    | ["structure", {
        type: TextErrorType
    }]
}