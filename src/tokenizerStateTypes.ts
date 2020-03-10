import { Location } from "./location"

export enum TokenType {
    COMMENT,
    QUOTED_STRING,
    NONE,
    UNQUOTED_TOKEN,
    WHITESPACE,
    NEWLINE,
}

export type CurrentToken =
    | [TokenType.COMMENT, CommentContext]
    | [TokenType.NEWLINE, NewLineContext]
    | [TokenType.NONE, NoneContext]
    | [TokenType.UNQUOTED_TOKEN]
    | [TokenType.QUOTED_STRING, StringContext]
    | [TokenType.WHITESPACE]

export type CommentContextState =
    | [CommentState.FOUND_ASTERISK, { start: Location }]
    | [CommentState.BLOCK_COMMENT]
    | [CommentState.FOUND_SOLIDUS, { start: Location }]
    | [CommentState.LINE_COMMENT]

export enum FoundNewLineCharacter {
    CARRIAGE_RETURN,
    LINE_FEED,
}

export type NewLineContext = {
    foundNewLineCharacter: FoundNewLineCharacter
    startLocation: Location
}
export type NoneContext = {
}

export type CommentContext = {
    state: CommentContextState
}

export type Unicode = {
    charactersLeft: number
    foundCharacters: ""
}

export type StringContext = {
    slashed: boolean
    readonly startCharacter: number
    unicode: null | Unicode
}

export enum CommentState {
    FOUND_SOLIDUS,
    FOUND_ASTERISK,
    LINE_COMMENT,
    BLOCK_COMMENT
}

export enum SimpleValueType {
    QUOTED_STRING,
    UNQUOTED_STRING,
}