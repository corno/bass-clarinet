/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import { Range } from "./location"
import { ITokenStreamConsumer } from "./ITokenStreamConsumer"
import { Chunk, Tokenizer, TokenizerOptions, LocationState } from "./Tokenizer"

const DEBUG = false

class StreamTokenizer<ReturnType, ErrorType> implements p.IStreamConsumer<string, null, ReturnType, ErrorType> {

    private readonly tokenizerState: Tokenizer
    private readonly locationState: LocationState
    private readonly tokenStreamConsumer: ITokenStreamConsumer<ReturnType, ErrorType>
    private aborted = false

    constructor(tokenStreamConsumer: ITokenStreamConsumer<ReturnType, ErrorType>, onerror: (message: string, range: Range) => void, opt?: TokenizerOptions) {
        this.tokenStreamConsumer = tokenStreamConsumer
        this.locationState = new LocationState(
            opt === undefined
                ? 4
                : opt.spaces_per_tab === undefined
                    ? 4
                    : opt.spaces_per_tab
        )
        this.tokenizerState = new Tokenizer(this.locationState, onerror)
    }
    private loopUntilPromiseOrEnd(currentChunk: Chunk): p.IValue<boolean> {
        if (this.aborted) {
            //ignore this data
            return p.result(true)
        }
        while (true) {
            const la = currentChunk.lookahead()
            if (la === null) {
                return p.result(false)
            }

            const tokenData = this.tokenizerState.createNextToken(currentChunk)

            if (tokenData !== null) {
                const onDataResult = this.tokenStreamConsumer.onData(tokenData)
                if (onDataResult instanceof Array) {
                    //console.log(tokenData)
                    if (onDataResult[0] === true) {
                        this.aborted = true
                        return p.result(true)
                    } else {
                        //token is handled properly, continue the loop
                    }
                } else {
                    return p.wrap.Value(onDataResult).mapResult(abortRequested => {
                        if (abortRequested) {
                            this.aborted = true
                            return p.result(true)
                        } else {
                            return this.loopUntilPromiseOrEnd(currentChunk)
                        }
                    })
                }
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
            onDataReturnValue.handle(_abort => {
                //nothing to abort anymore
            })
        }
        return this.tokenStreamConsumer.onEnd(aborted, this.locationState.getCurrentLocation())
    }
}

export function createStreamTokenizer<ReturnType, ErrorType>(
    tokenStreamConsumer: ITokenStreamConsumer<ReturnType, ErrorType>,
    onerror: (message: string, range: Range) => void,
    opt?: TokenizerOptions
): p.IStreamConsumer<string, null, ReturnType, ErrorType> {
    return new StreamTokenizer(tokenStreamConsumer, onerror, opt)
}