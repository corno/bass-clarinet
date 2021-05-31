import * as p from "pareto"
import { ITreeParserEventConsumer, ParserAnnotationData } from "../src"

export const dummyParserEventConsumer: ITreeParserEventConsumer<ParserAnnotationData, null, null> = {
    onData: () => {
        return p.value(false)
    },
    onEnd: () => {
        return p.success(null)
    },
}
