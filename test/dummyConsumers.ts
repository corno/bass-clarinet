import * as p from "pareto"
import { ParserEventConsumer } from "../src"

export const dummyParserEventConsumer: ParserEventConsumer<null, null> = {
    onData: () => {
        return p.result(false)
    },
    onEnd: () => {
        return p.success(null)
    },
}
