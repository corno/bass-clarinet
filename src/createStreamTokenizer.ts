/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as p20 from "pareto-20"
import { Range } from "./location"
import { ITokenStreamConsumer } from "./ITokenStreamConsumer"
import { Chunk, Tokenizer, TokenizerOptions, LocationState } from "./Tokenizer"

const DEBUG = false

class StreamTokenizer implements p.IStreamConsumer<string, null> {

    private readonly tokenizerState: Tokenizer
    private readonly locationState: LocationState
    private readonly tokenStreamConsumer: ITokenStreamConsumer
    private aborted = false

    constructor(tokenStreamConsumer: ITokenStreamConsumer, onerror: (message: string, range: Range) => void, opt?: TokenizerOptions) {
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
    private loopUntilPromiseOrEnd(currentChunk: Chunk): p.DataOrPromise<boolean> {
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
                    return p.wrap.SafePromise(onDataResult).mapResult(abortRequested => {
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
    public onData(chunk: string): p.DataOrPromise<boolean> {
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
        const currentChunk = new Chunk(chunk)
        return this.loopUntilPromiseOrEnd(currentChunk)
    }

    public onEnd(aborted: boolean): void {
        const tokenData = this.tokenizerState.handleDanglingToken()
        if (tokenData !== null) {
            const onDataReturnValue = this.tokenStreamConsumer.onData(tokenData)
            p20.handleDataOrPromise(onDataReturnValue, _abort => {
                //nothing to abort anymore
            })
        }
        this.tokenStreamConsumer.onEnd(aborted, this.locationState.getCurrentLocation())
    }
}

export function createStreamTokenizer(
    tokenStreamConsumer: ITokenStreamConsumer,
    onerror: (message: string, range: Range) => void,
    opt?: TokenizerOptions
): p.IStreamConsumer<string, null> {
    return new StreamTokenizer(tokenStreamConsumer, onerror, opt)
}