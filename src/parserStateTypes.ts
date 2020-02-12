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
    EXPECTING_OBJECTVALUE, // value in object
    EXPECTING_KEY_OR_OBJECT_END,
    EXPECTING_COMMA_OR_OBJECT_END, // , or }
    EXPECTING_KEY, // "a"
    EXPECTING_COLON, // :
}

export enum ArrayState {
    EXPECTING_ARRAYVALUE, // value in array
    EXPECTING_VALUE_OR_ARRAY_END,
    EXPECTING_COMMA_OR_ARRAY_END, // , or ]
}

export enum KeywordState {
    TRUE_EXPECTING_R, // r
    TRUE_EXPECTING_U, // u
    TRUE_EXPECTING_E, // e

    FALSE_EXPECTING_A, // a
    FALSE_EXPECTING_L, // l
    FALSE_EXPECTING_S, // s
    FALSE_EXPECTING_E, // e

    NULL_EXPECTING_U, // u
    NULL_EXPECTING_L1, // l
    NULL_EXPECTING_L2, // l
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
    STRING,
    KEYWORD,
    OBJECT,
    ARRAY,
    NUMBER,
    tagged_union,
}


export type OnStringFinished = (text: string, range: Range) => void

export type StackContext =
    | [StackContextType.ROOT, RootContext]
    | [StackContextType.ARRAY, ArrayContext]
    | [StackContextType.OBJECT, ObjectContext]
    | [StackContextType.tagged_union, TaggedUnionContext]

export type Context =
    | [ContextType.STACK]
    | [ContextType.COMMENT, CommentContext]
    | [ContextType.KEYWORD, KeywordContext]
    | [ContextType.NUMBER, NumberContext]
    | [ContextType.STRING, StringContext]

export enum StackContextType {
    ARRAY,
    OBJECT,
    ROOT,
    tagged_union,
}

export enum ContextType {
    COMMENT,
    KEYWORD,
    NUMBER,
    STACK,
    STRING,
}

export type Unicode = {
    charactersLeft: number
    foundCharacters: ""
}

export type ArrayContext = { state: ArrayState, openChar: number }

export type CommentContext = {
    state: CommentState
    commentNode: string
    start: Location
}

export type KeywordContext = {
    keywordNode: string
    start: Location
}

export type NumberContext = {
    start: Location
    numberNode: string
    foundExponent: boolean
    foundPeriod: boolean
}

export type ObjectContext = {
    state: ObjectState,
    openChar: number
}

export type RootContext = {
    state: RootState
}
export type StringContext = {
    startCharacter: number
    start: Location
    textNode: string
    onFinished: OnStringFinished
    unicode: null | Unicode
    slashed: boolean
}

export type TaggedUnionContext = {
    state: TaggedUnionState
}
