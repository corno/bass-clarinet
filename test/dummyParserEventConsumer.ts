import * as p from "pareto"
import * as core from "astn-core"
import { ParserAnnotationData } from "../src"

export const dummyParserEventConsumer: core.ITreeBuilder<ParserAnnotationData, null, null> = {
    onData: () => {
        return p.value(false)
    },
    onEnd: () => {
        return p.success(null)
    },
}
