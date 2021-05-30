import { Location } from "./location"

export enum TokenType {
    BLOCK_COMMENT,
    LINE_COMMENT,
    WRAPPED_STRING,
    NONWRAPPED_STRING,
    WHITESPACE,
    NONE,
}

export type CurrentToken =
    | [TokenType.BLOCK_COMMENT, BlockCommentContext]
    | [TokenType.LINE_COMMENT]
    | [TokenType.NONE, NoneContext]
    | [TokenType.NONWRAPPED_STRING]
    | [TokenType.WRAPPED_STRING, StringContext]
    | [TokenType.WHITESPACE]

export type BlockCommentContext = {
    locationOfFoundAsterisk: null | Location
}

export enum FoundNewlineCharacterType {
    CARRIAGE_RETURN,
    LINE_FEED,
}

export type FoundNewlineCharacter = {
    type: FoundNewlineCharacterType
    startLocation: Location
}

export type NoneContext = {
    foundNewlineCharacter: FoundNewlineCharacter | null
    foundSolidus: Location | null
}

export type Unicode = {
    charactersLeft: number
    foundCharacters: ""
}

export type StringContext = {
    slashed: boolean
    readonly startCharacter: number
    unicode: null | Unicode
    foundNewlineCharacter: FoundNewlineCharacter | null
}
