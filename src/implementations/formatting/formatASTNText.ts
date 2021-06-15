import * as p from "pareto"
import * as core from "astn-core"

import { parseString, printParsingError } from "../parser"
import { printRange } from "../../generic/location"
import { ParserAnnotationData } from "../../interfaces"

export function formatASTNText(
    astnText: string,
    formatter: core.Formatter<ParserAnnotationData, null>,
    write: (str: string) => void,
): p.IValue<null> {

    return parseString(
        astnText,
        _range => {
            write(formatter.onSchemaHeader())
            return core.createStackedParser<ParserAnnotationData, null, null>(
                core.createDecoratedTree(
                    formatter.schemaFormatter,
                    core.createTreeConcatenator(write, () => p.value(null)),
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
                () => core.createDummyValueHandler(() => p.value(null)),
            )
        },
        () => {
            const datasubscriber = core.createStackedParser<ParserAnnotationData, null, null>(
                core.createDecoratedTree(
                    formatter.bodyFormatter,
                    core.createTreeConcatenator(write, () => p.value(null)),
                ),
                error => {
                    console.error("FOUND STACKED DATA ERROR", error)
                },
                () => {
                    //onEnd
                    //no need to return an value, we're only here for the side effects, so return 'null'
                    return p.success(null)
                },

                () => core.createDummyValueHandler(() => p.value(null)),
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
            return p.value(null)
        },
        () => {
            write("\r\n")
            //we're only here for the side effects, so no need to handle the result (which is 'null' anyway)
            return p.value(null)
        }
    )
}