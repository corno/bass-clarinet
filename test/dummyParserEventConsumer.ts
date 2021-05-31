import * as p from "pareto"
import { ITreeBuilder, ParserAnnotationData } from "../src"

export const dummyParserEventConsumer: ITreeBuilder<ParserAnnotationData, null, null> = {
    onData: () => {
        return p.value(false)
    },
    onEnd: () => {
        return p.success(null)
    },
}
