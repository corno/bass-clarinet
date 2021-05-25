import * as p from "pareto"
import { TextParserEventConsumer } from "../src"

export const dummyParserEventConsumer: TextParserEventConsumer<null, null> = {
    onData: () => {
        return p.value(false)
    },
    onEnd: () => {
        return p.success(null)
    },
}
