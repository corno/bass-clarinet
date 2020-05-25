import { Location } from "./location"

export enum TokenType {
    BLOCK_COMMENT,
    LINE_COMMENT,
    QUOTED_STRING,
    UNQUOTED_TOKEN,
    WHITESPACE,
    NONE,
}

export type CurrentToken =
    | [TokenType.BLOCK_COMMENT, BlockCommentContext]
    | [TokenType.LINE_COMMENT]
    | [TokenType.NONE, NoneContext]
    | [TokenType.UNQUOTED_TOKEN]
    | [TokenType.QUOTED_STRING, StringContext]
    | [TokenType.WHITESPACE]

export type BlockCommentContext = {
    foundAsterisk: null | Location
}

export enum FoundCharacterType {
    SOLIDUS,
    CARRIAGE_RETURN,
    LINE_FEED,
}

export type FoundCharacter = {
    type: FoundCharacterType
    startLocation: Location
}

export type NoneContext = {
    foundCharacter: FoundCharacter | null
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
