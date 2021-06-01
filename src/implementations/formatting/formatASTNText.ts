import * as p from "pareto"
import * as core from "astn-core"

import { parseString, printParsingError } from "../parser"
import { printRange } from "../../generic/location"
import { ParserAnnotationData } from "../../interfaces"

export function formatASTNText(
    astnText: string,
    formatter: core.Formatter<ParserAnnotationData, null>,
    consumer: p.IStreamConsumer<string, null, null>,
): p.IValue<null> {

    function write(str: string) {
        consumer.onData(str)
    }

    return parseString(
        astnText,
        _range => {
            write(formatter.onSchemaHeader())
            return core.createStackedParser<ParserAnnotationData, null, null>(
                core.createDecoratedTree(
                    formatter.schemaFormatter,
                    core.createTreeConcatenator(write),
                ),
                _error => {
                    //
                },
                () => {
                    write(formatter.onAfterSchema())
                    //onEnd
                    //no need to return an value, we're only here for the side effects, so return 'null'
                    return p.success(null)
                },

                core.createDummyValueHandler,
            )
        },
        () => {
            const datasubscriber = core.createStackedParser<ParserAnnotationData, null, null>(
                core.createDecoratedTree(
                    formatter.bodyFormatter,
                    core.createTreeConcatenator(write),
                ),
                error => {
                    console.error("FOUND STACKED DATA ERROR", error)
                },
                () => {
                    //onEnd
                    //no need to return an value, we're only here for the side effects, so return 'null'
                    return p.success(null)
                },

                core.createDummyValueHandler,
            )
            return datasubscriber
        },
        (err, range) => { console.error(`found error: ${printParsingError(err)} @ ${printRange(range)}`) },
        _overheadToken => {
            return p.value(false)
        },
    ).reworkAndCatch(
        () => {
            write("\r\n")
            //we're only here for the side effects, so no need to handle the error
            return consumer.onEnd(false, null)
        },
        () => {
            write("\r\n")
            //we're only here for the side effects, so no need to handle the result (which is 'null' anyway)
            return consumer.onEnd(false, null)
        }
    )
}