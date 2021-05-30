import * as p from "pareto"
import { ITreeParserEventConsumer } from "../src"

export const dummyParserEventConsumer: ITreeParserEventConsumer<null, null> = {
    onData: () => {
        return p.value(false)
    },
    onEnd: () => {
        return p.success(null)
    },
}
