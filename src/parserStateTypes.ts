import { Location, Range } from "./location"

export enum RootState {
    EXPECTING_SCHEMA_START,
    EXPECTING_SCHEMA_START_OR_ROOT_VALUE,
    EXPECTING_SCHEMA,
    EXPECTING_HASH_OR_ROOTVALUE,
    EXPECTING_ROOTVALUE_AFTER_HEADER,
    EXPECTING_ROOTVALUE_WITHOUT_HEADER,
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

export enum ComplexValueType {
    OBJECT,
    ARRAY,
    TAGGED_UNION,
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

export enum ExpectedType {
    VALUE,
    KEY,
    OPTION,
}


export enum TokenType {
    COMMENT,
    QUOTED_STRING,
    NONE,
    UNQUOTED_TOKEN,
    WHITESPACE,
}

export type CurrentToken =
    | [TokenType.NONE]
    | [TokenType.COMMENT, CommentContext]
    | [TokenType.UNQUOTED_TOKEN, UnquotedTokenContext]
    | [TokenType.QUOTED_STRING, QuotedStringContext]
    | [TokenType.WHITESPACE, WhitespaceContext]


export type CommentContext = {
    commentNode: string
    readonly start: Range
}

export type UnquotedTokenContext = {
    unquotedTokenNode: string
    readonly start: Location
}
export type WhitespaceContext = {
    whitespaceNode: string
    readonly start: Location
}

export type QuotedStringContext = {
    readonly startCharacter: string
    readonly start: Range
    quotedStringNode: string
}
