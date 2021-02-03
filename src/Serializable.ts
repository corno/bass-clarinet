import * as fp from "fountain-pen"

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
        quote: string | null
        value: string
    }]
    | ["array", {
        elements: IInArray<SerializableValue>
        openCharacter: string
        commentData: SerializableCommentData
    }]
    | ["object", {
        properties: SerializableProperties
        openCharacter: string
        commentData: SerializableCommentData
    }]
    | ["tagged union", {
        option: string
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