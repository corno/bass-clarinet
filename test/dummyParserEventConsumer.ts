import * as p from "pareto"
import * as core from "astn-core"
import { TokenizerAnnotationData } from "../src"

export const dummyParserEventConsumer: core.ITreeBuilder<TokenizerAnnotationData> = {
    onData: () => {
        return p.value(false)
    },
    onEnd: () => {
        return p.value(null)
    },
}
