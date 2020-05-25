/* eslint
    complexity:"off",
    no-console:"off",
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as p20 from "pareto-20"
import { Range } from "./location"
import { ITokenStreamConsumer } from "./ITokenStreamConsumer"
import { OnDataReturnValue, IStreamConsumer } from "./IStreamConsumer"
import { Chunk, TokenizerState, TokenizerOptions } from "./TokenizerState"

const DEBUG = false

type QueueEntry =
    | [false, Chunk] //end not reached
    | [true, {
        aborted: boolean
    }] //end reached

class Tokenizer implements IStreamConsumer<string, null> {

    private currentChunk: null | Chunk = null
    private readonly tokenizerState: TokenizerState
    private ended = false

    private readonly queue: QueueEntry[] = []

    private readonly tokenStreamConsumer: ITokenStreamConsumer

    constructor(tokenStreamConsumer: ITokenStreamConsumer, onerror: (message: string, range: Range) => void, opt?: TokenizerOptions) {
        this.tokenStreamConsumer = tokenStreamConsumer
        this.tokenizerState = new TokenizerState(opt || {}, onerror)
    }
    public onData(chunk: string): OnDataReturnValue {
        if (this.ended) {
            throw new Error("cannot write, stream is ended")
        }
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
        if (this.currentChunk === null) {
            this.currentChunk = new Chunk(chunk)
            this.writeImp(this.currentChunk)
            this.emptyQueue()
        } else {
            this.queue.push([false, new Chunk(chunk)])
        }
        return p.result(false)
    }
    private emptyQueue() {
        while (this.currentChunk === null) {
            const nextChunk = this.queue.shift()
            if (nextChunk !== undefined) {
                if (nextChunk[0]) { //end reached
                    this.onEndImp(nextChunk[1].aborted)
                } else {
                    this.writeImp(nextChunk[1])
                }
            } else {
                return
            }
        }
    }
    private writeImp(currentChunk: Chunk): void {
        while (true) {
            const tokenData = this.tokenizerState.createNextToken(currentChunk)

            if (tokenData === null) { //end of chunk
                return
            }
            const onDataResult = this.tokenStreamConsumer.onData(tokenData)
            // if (onDataResult instanceof Array) {
            //     if (onDataResult === true) {

            //     }
            // }
            p20.handleDataOrPromise(onDataResult, _abort => {
                //NOTHING TO DO FOR NOW
            })
        }
    }

    public onEnd(aborted: boolean): void {
        if (this.ended) {
            throw new Error("cannot end, already ended")
        }
        if (this.currentChunk !== null) {
            this.queue.push([true, {
                aborted: aborted,
            }])
        } else {
            this.onEndImp(aborted)
        }
    }
    public onEndImp(aborted: boolean) {
        const tokenData = this.tokenizerState.handleDanglingToken()
        if (tokenData !== null) {
            const onDataReturnValue = this.tokenStreamConsumer.onData(tokenData)
            p20.handleDataOrPromise(onDataReturnValue, _abort => {
                //nothing to abort anymore
            })
        }
        this.tokenStreamConsumer.onEnd(aborted, this.tokenizerState.getNextLocation())

        this.ended = true
    }
}

export function createTokenizer(
    tokenStreamConsumer: ITokenStreamConsumer,
    onerror: (message: string, range: Range) => void,
    opt?: TokenizerOptions
): IStreamConsumer<string, null> {
    return new Tokenizer(tokenStreamConsumer, onerror, opt)
}