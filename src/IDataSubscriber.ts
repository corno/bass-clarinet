import { Pauser } from "./parserAPI"
import { Location, Range } from "./location"

export type OpenData = {
    start: Range
    openCharacter: string
    pauser: Pauser
}

export type CloseData = {
    range: Range
    closeCharacter: string
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

export type TaggedUnionData = {
    startRange: Range
    pauser: Pauser
}

export type OptionData = {
    range: Range
    pauser: Pauser
}

export interface IDataSubscriber {
    onComma(range: Range, pauser: Pauser): void
    onColon(range: Range, pauser: Pauser): void

    onOpenArray(metaData: OpenData): void
    onCloseArray(metaData: CloseData): void //there is only metadata if the array is properly closed

    onOpenTaggedUnion(range: Range, pauser: Pauser): void

    onOpenObject(metaData: OpenData): void
    onCloseObject(metaData: CloseData): void //there is only metadata if the object is properly closed

    onString(value: string, metaData: StringData): void

    onBlockComment(comment: string, range: Range, pauser: Pauser): void
    onLineComment(comment: string, range: Range, pauser: Pauser): void

    onNewLine(range: Range): void
    onWhitespace(value: string, range: Range): void
    onEnd(location: Location): void
}

