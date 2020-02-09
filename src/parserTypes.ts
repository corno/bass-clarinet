import { Location } from "./location"

export type Allow = {
    trailing_commas?: boolean
    parens_instead_of_braces?: boolean
    angle_brackets_instead_of_brackets?: boolean
    comments?: boolean
    missing_commas?: boolean
    apostrophes_instead_of_quotation_marks?: boolean
    typed_unions?: boolean
    schema_reference?: boolean
}

export type Options = {
    spaces_per_tab?: number
    allow?: Allow
    require_schema_reference?: boolean
}

export enum RootState {
    EXPECTING_SCHEMA_START,
    EXPECTING_SCHEMA_START_OR_ROOT_VALUE,
    EXPECTING_SCHEMA_REFERENCE,
    EXPECTING_ROOTVALUE, // value at the root
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

export enum GlobalStateType {
    ERROR,
    COMMENT,
    STRING,
    NUMBER,
    KEYWORD,
    ROOT,
    ARRAY,
    OBJECT,
    TYPED_UNION,
}

export type GlobalState =
    | [GlobalStateType.ERROR, {
        error: Error
    }]
    | [GlobalStateType.NUMBER, {
        start: Location
        numberNode: string
        foundExponent: boolean
        foundPeriod: boolean
    }]
    | [GlobalStateType.KEYWORD, {
        state: KeywordState
    }]
    | [GlobalStateType.STRING, {
        startCharacter: number
        start: Location
        textNode: string
        stringType: StringType
        unicode: null | Unicode
        slashed: boolean // = false
    }]
    | [GlobalStateType.ROOT, { state: RootState }]
    | [GlobalStateType.OBJECT, { state: ObjectState, context: ObjectContext }]
    | [GlobalStateType.ARRAY, { state: ArrayState, context: ArrayContext }]
    | [GlobalStateType.TYPED_UNION, { state: TypedUnionState }]

export enum StringTypeEnum {
    KEY,
    VALUE,
    TYPED_UNION_STATE,
    SCHEMA_REFERENCE,
}

export type StringType =
    | [StringTypeEnum.KEY, { containingObject: ObjectContext }]
    | [StringTypeEnum.VALUE, { }]
    | [StringTypeEnum.TYPED_UNION_STATE, { }]
    | [StringTypeEnum.SCHEMA_REFERENCE, { startLocation: Location }]

export enum TypedUnionState {
    EXPECTING_OPTION,
    EXPECTING_VALUE,
}

export type ObjectContext = { openChar: number }
export type ArrayContext = { openChar: number }

export type Context =
    | [ContextType.ROOT]
    | [ContextType.OBJECT, ObjectContext]
    | [ContextType.ARRAY, ArrayContext]
    | [ContextType.TYPED_UNION]

export enum ContextType {
    ROOT,
    OBJECT,
    ARRAY,
    TYPED_UNION,
}

export type Unicode = {
    charactersLeft: number
    foundCharacters: ""
}

export enum CommentState {
    FOUND_SLASH,
    FOUND_ASTERISK,
    LINE_COMMENT,
    BLOCK_COMMENT
}

export enum ValueType {
    STRING,
    FALSE,
    TRUE,
    NULL,
    OBJECT,
    ARRAY,
    NUMBER,
    TYPED_UNION,
}
