import {
    Range,
} from "../generic/location"


export type Comment = {
    text: string
    outerRange: Range
    innerRange: Range
    type:
    | "block"
    | "line"
    indent: null | string
}

// import {
//     ArrayHandler,
//     ObjectHandler,
//     RequiredValueHandler,
//     TaggedUnionHandler,
//     TreeHandler,
//     ValueHandler,
// } from "astn-core"

export type BeforeContextData = {
    comments: Comment[]
}

export type ContextData = {
    before: BeforeContextData
    lineCommentAfter: null | Comment
}

export type TokenizerAnnotationData = {
    indentation: string
    tokenString: string | null
    contextData: ContextData
    range: Range
}
