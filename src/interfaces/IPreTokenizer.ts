import { Location } from "../location"
import { PreToken } from "./IPreTokenStreamConsumer"
//import { Char } from "../Characters"

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