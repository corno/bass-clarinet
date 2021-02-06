import * as fp from "fountain-pen"
import { Quote } from "./PreToken"

export interface IInDictionary<T> {
    isEmpty(): boolean
    map<R>(callback: (property: T, key: string) => R): IInArray<R>
}
export interface IInArray<T> extends fp.IInArray<T> {
    isEmpty(): boolean
    map<R>(callback: (element: T) => R): IInArray<R>
}

export type SerializableProperty = {
    commentData: SerializableCommentData
    quote: null | Quote
    value: SerializableValue
}

export type SerializableProperties = IInDictionary<SerializableProperty>

export type SerializableComment = {
    text: string
}

export type SerializableBeforeCommentData = {
    comments: IInArray<SerializableComment>
}
export type SerializableCommentData = {
    before: SerializableBeforeCommentData
    lineCommentAfter: null | string
}

export type SerializableValue = {
    commentData: SerializableCommentData
    type:
    | ["simple value", {
        quote: Quote | null
        value: string
    }]
    | ["array", {
        elements: IInArray<SerializableValue>
        openCharacter: "[" | "<"
        closeCharacter: "]" | ">"
        commentData: SerializableCommentData
    }]
    | ["object", {
        properties: SerializableProperties
        openCharacter: "(" | "{"
        closeCharacter: ")" | "}"
        commentData: SerializableCommentData
    }]
    | ["tagged union", {
        option: string
        quote: null | Quote
        commentData: SerializableCommentData
        data: SerializableValue
    }]
}

export type SerializableDocument = {
    schema: null | SerializableValue
    compact: boolean
    root: SerializableValue
    documentComments: IInArray<SerializableComment>
}