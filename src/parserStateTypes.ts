import { Location, Range } from "./location"

export enum RootState {
    EXPECTING_SCHEMA_START_OR_ROOT_VALUE,
    EXPECTING_SCHEMA,
    EXPECTING_HASH_OR_ROOTVALUE,
    EXPECTING_ROOTVALUE_AFTER_HEADER,
    EXPECTING_END, // no more input expected
}

export enum ObjectState {
    EXPECTING_OBJECT_VALUE,
    EXPECTING_KEY,
}

export enum TaggedUnionState {
    EXPECTING_OPTION,
    EXPECTING_VALUE,
}

export type StackContext =
    | [StackContextType.ROOT, RootContext]
    | [StackContextType.ARRAY, {}]
    | [StackContextType.OBJECT, ObjectContext]
    | [StackContextType.TAGGED_UNION, TaggedUnionContext]

export enum StackContextType {
    ARRAY,
    OBJECT,
    ROOT,
    TAGGED_UNION,
}

export type ArrayContext = {
    readonly openChar: number
}

export type ObjectContext = {
    state: ObjectState
    readonly openChar: number
}

export type RootContext = {
    state: RootState
}

export type TaggedUnionContext = {
    state: TaggedUnionState
}

export enum TokenType {
    LINE_COMMENT,
    BLOCK_COMMENT,
    QUOTED_STRING,
    NONE,
    UNQUOTED_TOKEN,
    WHITESPACE,
}

export type CurrentToken =
    | [TokenType.NONE]
    | [TokenType.LINE_COMMENT, CommentContext]
    | [TokenType.BLOCK_COMMENT, CommentContext]
    | [TokenType.UNQUOTED_TOKEN, UnquotedTokenContext]
    | [TokenType.QUOTED_STRING, QuotedStringContext]
    | [TokenType.WHITESPACE, WhitespaceContext]


export type CommentContext = {
    commentNode: string
    readonly start: Range
    readonly indentation: null | string
}

export type UnquotedTokenContext = {
    unquotedTokenNode: string
    readonly start: Location
}
export type WhitespaceContext = {
    whitespaceNode: string
    readonly start: Location
}

export enum IndentationState {
    lineIsVirgin,
    foundIndentation,
    lineIsDitry,
}

export type IndentationData =
| [IndentationState.foundIndentation, WhitespaceContext]
| [IndentationState.lineIsVirgin]
| [IndentationState.lineIsDitry]

export type QuotedStringContext = {
    readonly startCharacter: string
    readonly start: Range
    quotedStringNode: string
}
