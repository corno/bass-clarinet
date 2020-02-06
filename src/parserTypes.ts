export type Allow = {
    trailing_commas?: boolean
    parens_instead_of_braces?: boolean
    angle_brackets_instead_of_brackets?: boolean
    comments?: boolean
    missing_commas?: boolean
    apostrophes_instead_of_quotation_marks?: boolean
    typed_unions?: boolean
}


export type Options = {
    spaces_per_tab?: number
    allow?: Allow
}

export enum RootState {
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
}

export type StringType =
    | [StringTypeEnum.KEY, { containingObject: ObjectContext }]
    | [StringTypeEnum.VALUE, {}]
    | [StringTypeEnum.TYPED_UNION_STATE, { }]

export enum TypedUnionState {
    EXPECTING_OPTION,
    EXPECTING_VALUE,
}

export const TypedUnionChar = {
    verticalLine:  0x7C,     // |
}

export const CommentChar = {
    solidus: 0x2F,           // /
    asterisk: 0x2A,          // *
}

export const WhitespaceChar = {
    tab: 0x09,               // \t
    lineFeed: 0x0A,          // \n
    carriageReturn: 0x0D,    // \r
    space: 0x20,             // " "
}

export const NumberChar = {

    plus: 0x2B,              // +
    minus: 0x2D,             // -
    period: 0x2E,            // .

    _0: 0x30,                // 0
    _9: 0x39,                // 9
    e: 0x65,                 // e 
    E: 0x45,                 // E
}

export const KeywordChar = {
    a: 0x61,                 // a
    e: 0x65,                 // e 
    f: 0x66,                 // f
    l: 0x6C,                 // l
    n: 0x6E,                 // n
    r: 0x72,                 // r
    s: 0x73,                 // s
    t: 0x74,                 // t
    u: 0x75,                 // u
}

export const StringChar = {
    quotationMark: 0x22,     // "
    apostrophe: 0x27,     // '
    reverseSolidus: 0x5C,    // \
    solidus: 0x2F,           // /

    b: 0x62,                 // b
    f: 0x66,                 // f
    n: 0x6E,                 // n
    r: 0x72,                 // r
    t: 0x74,                 // t
    u: 0x75,                 // u
}

export const ArrayChar = {
    comma: 0x2C,             // ,
    openBracket: 0x5B,       // [
    closeBracket: 0x5D,      // ]
    openAngleBracket: 0x3C,  // <
    closeAngleBracket: 0x3E  // >
}

export const ObjectChar = {
    comma: 0x2C,             // ,
    colon: 0x3A,             // :
    openBrace: 0x7B,         // {
    closeBrace: 0x7D,        // }
    openParen: 0x28,         // )
    closeParen: 0x29,        // )
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

export type Location = {
    readonly position: number,
    readonly line: number,
    readonly column: number,
}

export type Range = {
    start: Location
    end: Location
}


export type Event =
    | "ready"
    | "end"
    | "error"
    | "openobject"
    | "closeobject"
    | "openarray"
    | "closearray"
    | "key"
    | "value"

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
