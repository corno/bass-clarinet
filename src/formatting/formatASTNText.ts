import * as p from "pareto"
import { createDecoratedTree } from "../implementations/createDecorator"
import { createTreeConcatenator } from "./concatenateFormatInstructions"
import { createStackedParser } from "../implementations/stackedParser"
import { parseString, printParsingError } from "../parser"
import { printRange } from "../location"
import { Formatter } from "./Formatter"
import { ParserAnnotationData } from "../interfaces"

export function formatASTNText(
    astnText: string,
    formatter: Formatter<ParserAnnotationData, null>,
    consumer: p.IStreamConsumer<string, null, null>,
): p.IValue<null> {

    function write(str: string) {
        consumer.onData(str)
    }

    return parseString(
        astnText,
        _range => {
            formatter.onSchemaHeader()
            return createStackedParser<null, null>(
                createDecoratedTree(
                    formatter.schemaFormatter,
                    createTreeConcatenator(write),
                ),
                _error => {
                    //
                },
                () => {
                    //onEnd
                    //no need to return an value, we're only here for the side effects, so return 'null'
                    return p.success(null)
                }
            )
        },
        () => {
            const datasubscriber = createStackedParser<null, null>(
                createDecoratedTree(
                    formatter.bodyFormatter,
                    createTreeConcatenator(write),
                ),
                error => {
                    console.error("FOUND STACKED DATA ERROR", error)
                },
                () => {
                    //onEnd
                    //no need to return an value, we're only here for the side effects, so return 'null'
                    return p.success(null)
                }
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