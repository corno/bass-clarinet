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

class Tokenizer implements IStreamConsumer<string, null> {

    private readonly tokenizerState: TokenizerState
    private readonly tokenStreamConsumer: ITokenStreamConsumer

    constructor(tokenStreamConsumer: ITokenStreamConsumer, onerror: (message: string, range: Range) => void, opt?: TokenizerOptions) {
        this.tokenStreamConsumer = tokenStreamConsumer
        this.tokenizerState = new TokenizerState(opt || {}, onerror)
    }
    public onData(chunk: string): OnDataReturnValue {
        if (DEBUG) console.log(`write -> [${JSON.stringify(chunk)}]`)
        this.writeImp(new Chunk(chunk))
        return p.result(false)
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
        const tokenData = this.tokenizerState.handleDanglingToken()
        if (tokenData !== null) {
            const onDataReturnValue = this.tokenStreamConsumer.onData(tokenData)
            p20.handleDataOrPromise(onDataReturnValue, _abort => {
                //nothing to abort anymore
            })
        }
        this.tokenStreamConsumer.onEnd(aborted, this.tokenizerState.getNextLocation())
    }
}

export function createTokenizer(
    tokenStreamConsumer: ITokenStreamConsumer,
    onerror: (message: string, range: Range) => void,
    opt?: TokenizerOptions
): IStreamConsumer<string, null> {
    return new Tokenizer(tokenStreamConsumer, onerror, opt)
}