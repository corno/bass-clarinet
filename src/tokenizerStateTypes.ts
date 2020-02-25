import { Location} from "./location"

export enum ContextType {
    COMMENT,
    QUOTED_STRING,
    STACK,
    UNQUOTED_TOKEN,
}

export type Context =
    | [ContextType.STACK]
    | [ContextType.COMMENT, CommentContext]
    | [ContextType.UNQUOTED_TOKEN]
    | [ContextType.QUOTED_STRING, StringContext]

export type CommentContextState =
    | [CommentState.FOUND_ASTERISK, { start: Location }]
    | [CommentState.BLOCK_COMMENT]
    | [CommentState.FOUND_SOLIDUS, { start: Location }]
    | [CommentState.LINE_COMMENT]

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