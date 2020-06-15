import * as p from "pareto"
import { ParserEventConsumer, HeaderConsumer } from "../src"

export const dummyParserEventConsumer: ParserEventConsumer<null, null> = {
    onData: () => {
        return p.result(false)
    },
    onEnd: () => {
        return p.success(null)
    },
}

export const dummyHeaderConsumer: HeaderConsumer<null, null> = {
    onSchemaDataStart: () => {
        return dummyParserEventConsumer
    },
    onInstanceDataStart: () => {
        return dummyParserEventConsumer
    },
}
