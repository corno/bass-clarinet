/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import { Location, Range } from "../../location"
import { ITokenStreamConsumer } from "../../parser/ITokenStreamConsumer"
import {
    IPreTokenizer,
    TokenizerOptions,
    createPreTokenizer,
    IChunk,
} from "../../pretokenizer"
import { PreTokenizerError } from "../../pretokenizer"

import {
    ILocationState,
} from "../../pretokenizer"
import * as Char from "../../Characters"

const DEBUG = false


class LocationState implements ILocationState {
    private readonly location = {
        position: -1,
        column: 0,
        line: 1,
    }
    private readonly spacesPerTab: number
    constructor(spacesPerTab: number) {
        this.spacesPerTab = spacesPerTab
    }
    public getCurrentLocation(): Location {
        return {
            position: this.location.position + 1,
            line: this.location.line,
            column: this.location.column + 1,
        }
    }
    public getNextLocation(): Location {
        return {
            position: this.location.position + 2,
            line: this.location.line,
            column: this.location.column + 2,
        }
    }
    public increase(character: number): void {
        this.location.position++
        //set the position
        switch (character) {
            case Char.Whitespace.lineFeed:
                this.location.line++
                this.location.column = 0
                break
            case Char.Whitespace.carriageReturn:
                break
            case Char.Whitespace.tab:
                this.location.column += this.spacesPerTab
                break
            default:
                this.location.column++
        }
    }
}


class Chunk implements IChunk {
    private currentIndex: number
    public readonly str: string
    constructor(str: string) {
        this.str = str
        this.currentIndex = -1
    }
    lookahead(): number | null {
        const char = this.str.charCodeAt(this.getIndexOfNextCharacter())
        return isNaN(char) ? null : char
    }
    increaseIndex(): void {
        this.currentIndex += 1
    }
    getIndexOfNextCharacter(): number {
        return this.currentIndex + 1
    }
    getString(): string {
        return this.str
    }
}

/**
 *
 * @param tokenStreamConsumer
 * @param onError
 * @param opt
 */
export function createStreamPreTokenizer<ReturnType, ErrorType>(
    tokenStreamConsumer: ITokenStreamConsumer<ReturnType, ErrorType>,
    onError: ($: {
        error: PreTokenizerError
        range: Range
    }) => void,
    opt?: TokenizerOptions
): p.IUnsafeStreamConsumer<string, null, ReturnType, ErrorType> {

    class StreamPreTokenizer implements p.IUnsafeStreamConsumer<string, null, ReturnType, ErrorType> {

        private readonly tokenizerState: IPreTokenizer
        private readonly locationState: LocationState
        private readonly tokenStreamConsumer: ITokenStreamConsumer<ReturnType, ErrorType>
        private aborted = false

        constructor(
        ) {
            this.tokenStreamConsumer = tokenStreamConsumer
            this.locationState = new LocationState(
                opt === undefined
                    ? 4
                    : opt.spaces_per_tab === undefined
                        ? 4
                        : opt.spaces_per_tab
            )
            this.tokenizerState = createPreTokenizer(this.locationState, onError)
        }
        private loopUntilPromiseOrEnd(currentChunk: IChunk): p.IValue<boolean> {
            if (this.aborted) {
                //ignore this data
                return p.value(true)
            }
            while (true) {
                const la = currentChunk.lookahead()
                if (la === null) {
                    return p.value(false)
                }

                const tokenData = this.tokenizerState.createNextToken(currentChunk)

                if (tokenData !== null) {
                    const onDataResult = this.tokenStreamConsumer.onData(tokenData)
                    return onDataResult.mapResult(abortRequested => {

                        if (abortRequested) {
                            this.aborted = true
                            return p.value(true)
                        } else {
                            return this.loopUntilPromiseOrEnd(currentChunk)
                        }
                    })
                }
            }
        }
        public onData(chunk: string): p.IValue<boolean> {
            if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
            const currentChunk = new Chunk(chunk)
            return this.loopUntilPromiseOrEnd(currentChunk)
        }

        public onEnd(aborted: boolean): p.IUnsafeValue<ReturnType, ErrorType> {
            const tokenData = this.tokenizerState.handleDanglingToken()
            if (tokenData !== null) {
                const onDataReturnValue = this.tokenStreamConsumer.onData(tokenData)
                return onDataReturnValue.try(_abort => {
                    //nothing to abort anymore
                    return this.tokenStreamConsumer.onEnd(aborted, this.locationState.getCurrentLocation())

                })
            } else {
                return this.tokenStreamConsumer.onEnd(aborted, this.locationState.getCurrentLocation())
            }
        }
    }

    return new StreamPreTokenizer()
}