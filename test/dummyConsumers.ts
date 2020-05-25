import * as p from "pareto"
import { IParserEventConsumer, HeaderConsumer } from "../src"

export const dummyParserEventConsumer: IParserEventConsumer = {
    onData: () => {
        return p.result(false)
    },
    onEnd: () => {
        //
    },
}

export const dummyHeaderConsumer: HeaderConsumer = {
    onCompact: () => {
        //
    },
    onHeaderStart: () => {
        return dummyParserEventConsumer
    },
    onHeaderEnd: () => {
        return dummyParserEventConsumer
    },
}
