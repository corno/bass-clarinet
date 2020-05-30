import * as p from "pareto"
import * as bc from "../src"

export const dummyParserEventConsumer: p.IStreamConsumer<bc.ParserEvent, bc.Location, null> = {
    onData: () => {
        return p.result(false)
    },
    onEnd: () => {
        return p.result(null)
    },
}

export const dummyHeaderConsumer: bc.HeaderConsumer<null> = {
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
