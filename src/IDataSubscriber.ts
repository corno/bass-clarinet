import { Pauser } from "./parserAPI"
import { Location, Range } from "./location"

export type OpenData = {
    openCharacter: string
    range: Range
    pauser: Pauser
}

export type CloseData = {
    closeCharacter: string
    range: Range
    pauser?: Pauser
}

export type PropertyData = {
    keyRange: Range
}

export type StringData = {
    quote: string | null
    terminated: boolean | null
    range: Range
    pauser: Pauser
}

export type SimpleMetaData = {
    range: Range
    pauser: Pauser
}
export type CommentMetaData = {
    outerRange: Range //with the open and close tokens: /*...*/ or //...
    innerRange: Range //without the open and close tokens: ...
    pauser: Pauser
    indentation: null | string
}

export interface IDataSubscriber {
    onComma(metaData: SimpleMetaData): void
    onColon(metaData: SimpleMetaData): void

    onOpenArray(metaData: OpenData): void
    onCloseArray(metaData: CloseData): void //there is only metadata if the array is properly closed

    onOpenTaggedUnion(metaData: SimpleMetaData): void

    onOpenObject(metaData: OpenData): void
    onCloseObject(metaData: CloseData): void //there is only metadata if the object is properly closed

    onString(value: string, metaData: StringData): void

    onBlockComment(comment: string, metaData: CommentMetaData): void
    onLineComment(comment: string, metaData: CommentMetaData): void

    onNewLine(metaData: SimpleMetaData): void
    onWhitespace(value: string, metaData: SimpleMetaData): void
    onEnd(location: Location): void
}

