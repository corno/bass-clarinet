import * as p from "pareto"
import { TreeParserEventConsumer } from "../src"

export const dummyParserEventConsumer: TreeParserEventConsumer<null, null> = {
    onData: () => {
        return p.value(false)
    },
    onEnd: () => {
        return p.success(null)
    },
}
