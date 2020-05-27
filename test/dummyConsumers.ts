import * as p from "pareto"
import * as bc from "../src"

export const dummyParserEventConsumer: p.IStreamConsumer<bc.ParserEvent, bc.Location> = {
    onData: () => {
        return p.result(false)
    },
    onEnd: () => {
        //
    },
}

export const dummyHeaderConsumer: bc.HeaderConsumer = {
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
