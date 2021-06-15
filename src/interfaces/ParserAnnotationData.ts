import * as p from "pareto"
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

import {
    ArrayHandler,
    ObjectHandler,
    RequiredValueHandler,
    TaggedUnionHandler,
    TreeHandler,
    ValueHandler,
} from "astn-core"

export type BeforeContextData = {
    comments: Comment[]
}

export type ContextData = {
    before: BeforeContextData
    lineCommentAfter: null | Comment
}

export type ParserAnnotationData = {
    indentation: string
    tokenString: string
    contextData: ContextData
    range: Range
}

export type ParserTreeHandler = TreeHandler<ParserAnnotationData, null, p.IValue<null>>
export type ParserRequiredValueHandler = RequiredValueHandler<ParserAnnotationData, null, p.IValue<null>>
export type ParserValueHandler = ValueHandler<ParserAnnotationData, null, p.IValue<null>>
export type ParserObjectHandler = ObjectHandler<ParserAnnotationData, null, p.IValue<null>>
export type ParserTaggedUnionHandler = TaggedUnionHandler<ParserAnnotationData, null, p.IValue<null>>
export type ParserArrayHandler = ArrayHandler<ParserAnnotationData, null, p.IValue<null>>