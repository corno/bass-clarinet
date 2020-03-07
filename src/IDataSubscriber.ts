import { Pauser } from "./parserAPI"
import { Location, Range } from "./location"

export enum SimpleValueRole {
    VALUE,
    OPTION,
    KEY,
}

export type OpenData = {
    start: Range
    openCharacter: string
    pauser: Pauser
}

export type CloseData = {
    range: Range
    closeCharacter: string
    pauser: Pauser
}

export type PropertyData = {
    keyRange: Range
}

export type SimpleValueData = {
    quote: string | null
    terminated: boolean | null
    range: Range
    pauser: Pauser
    role: SimpleValueRole
}

export type TaggedUnionData = {
    startRange: Range
    optionRange: Range
    pauser: Pauser
}

export interface IDataSubscriber {
    onComma(range: Range, pauser: Pauser): void
    onColon(range: Range, pauser: Pauser): void

    onOpenArray(metaData: OpenData): void
    onCloseArray(metaData: CloseData): void

    onOpenTaggedUnion(range: Range, pauser: Pauser): void
    onCloseTaggedUnion(location: Location): void

    onOpenObject(metaData: OpenData): void
    onCloseObject(metaData: CloseData): void

    onQuotedString(value: string, metaData: SimpleValueData): void
    onUnquotedToken(value: string, metaData: SimpleValueData): void

    onBlockComment(comment: string, range: Range, pauser: Pauser): void
    onLineComment(comment: string, range: Range, pauser: Pauser): void

    onNewLine(range: Range): void
    onWhitespace(value: string, range: Range): void
    onEnd(location: Location): void
}

