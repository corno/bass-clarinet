import { Location, Range } from "./location"

export enum RootState {
    EXPECTING_SCHEMA_START,
    EXPECTING_SCHEMA_START_OR_ROOT_VALUE,
    EXPECTING_SCHEMA,
    EXPECTING_HASH_OR_ROOTVALUE,
    EXPECTING_ROOTVALUE,
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

export enum CommentState {
    FOUND_SOLIDUS,
    FOUND_ASTERISK,
    LINE_COMMENT,
    BLOCK_COMMENT
}

export enum ValueType {
    QUOTED_STRING,
    UNQUOTED_STRING,
    OBJECT,
    ARRAY,
    TAGGED_UNION,
}


export type OnStringFinished = (text: string, range: Range) => void

export type StackContext =
    | [StackContextType.ROOT, RootContext]
    | [StackContextType.ARRAY, {}]
    | [StackContextType.OBJECT, ObjectContext]
    | [StackContextType.TAGGED_UNION, TaggedUnionContext]

export type Context =
    | [ContextType.STACK]
    | [ContextType.COMMENT, CommentContext]
    | [ContextType.UNQUOTED_STRING, UnquotedStringContext]
    | [ContextType.QUOTED_STRING, StringContext]

export enum StackContextType {
    ARRAY,
    OBJECT,
    ROOT,
    TAGGED_UNION,
}

export enum ContextType {
    COMMENT,
    QUOTED_STRING,
    STACK,
    UNQUOTED_STRING,
}

export type Unicode = {
    charactersLeft: number
    foundCharacters: ""
}

export type ArrayContext = {
    readonly openChar: number
}

export type CommentContext = {
    state: CommentState
    commentNode: string
    readonly start: Location
}

export type UnquotedStringContext = {
    unquotedStringNode: string
    readonly start: Location
}

export type NumberContext = {
    readonly start: Location
    numberNode: string
    foundExponent: boolean
    foundPeriod: boolean
}

export type ObjectContext = {
    state: ObjectState
    readonly openChar: number
}

export type RootContext = {
    state: RootState
}
export type StringContext = {
    readonly startCharacter: number
    readonly start: Location
    textNode: string
    readonly onFinished: OnStringFinished
    unicode: null | Unicode
    slashed: boolean
}

export type TaggedUnionContext = {
    state: TaggedUnionState
}
