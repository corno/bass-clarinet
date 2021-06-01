import { Location } from "../generic/location"
import { PreToken } from "./IPreTokenStreamConsumer"


export interface ILocationState {
    getCurrentLocation(): Location
    getNextLocation(): Location
    increase(character: number): void
}

export interface IChunk {
    lookahead(): number | null
    getIndexOfNextCharacter(): number
    getString(): string
    increaseIndex(): void
}

export interface IPreTokenizer {
    handleDanglingToken(): PreToken | null
    createNextToken(currentChunk: IChunk): null | PreToken
}