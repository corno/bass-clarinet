export enum ContextType {
    COMMENT,
    QUOTED_STRING,
    STACK,
    UNQUOTED_STRING,
}

export type Context =
    | [ContextType.STACK]
    | [ContextType.COMMENT, CommentContext]
    | [ContextType.UNQUOTED_STRING]
    | [ContextType.QUOTED_STRING, StringContext]


export type CommentContext = {
    state: CommentState
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