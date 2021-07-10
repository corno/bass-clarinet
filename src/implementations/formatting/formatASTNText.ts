import * as p from "pareto"
import * as core from "astn-core"
import { createErrorStreamHandler, createParserStack } from "../parser"
import { TokenizerAnnotationData } from "../../interfaces"
import { createSerializedQuotedString } from "astn-core"

export function createASTNTextFormatter(
    formatter: core.Formatter<TokenizerAnnotationData, null>,
    endString: string,
    write: (str: string) => void,
): p.IStreamConsumer<string, null, null> {
    const ps = createParserStack({

        onEmbeddedSchema: _range => {
            write(formatter.onSchemaHeader())
            return core.createStackedParser<TokenizerAnnotationData>(
                core.createSemanticState({
                    treeHandler: core.createDecoratedTree(
                        formatter.schemaFormatter,
                        core.createTreeConcatenator(write, () => p.value(null)),
                    ),
                    raiseError: _error => {
                        //
                    },
                    createReturnValue: () => {
                        return p.value(null)
                    },
                    createUnexpectedValueHandler: () => core.createDummyValueHandler(() => p.value(null)),
                    onEnd: () => {
                        write(formatter.onAfterSchema())
                        //onEnd
                        //no need to return an value, we're only here for the side effects, so return 'null'
                        return p.value(null)
                    },
                })
            )
        },
        onSchemaReference: schemaReference => {
            write(createSerializedQuotedString(schemaReference.value))
            return p.value(null)
        },
        onBody: () => {
            const datasubscriber = core.createStackedParser<TokenizerAnnotationData>(
                core.createSemanticState({
                    treeHandler: core.createDecoratedTree(
                        formatter.bodyFormatter,
                        core.createTreeConcatenator(write, () => p.value(null)),
                    ),
                    raiseError: error => {
                        console.error("FOUND STACKED DATA ERROR", error)
                    },
                    createReturnValue: () => {
                        return p.value(null)
                    },
                    createUnexpectedValueHandler: () => core.createDummyValueHandler(() => p.value(null)),
                    onEnd: () => {
                        //onEnd
                        //no need to return an value, we're only here for the side effects, so return 'null'
                        return p.value(null)
                    },
                })
            )
            return datasubscriber
        },
        errorStreams: createErrorStreamHandler(true, str => console.error(str)),
    })

    return {
        onData: $ => ps.onData($),
        onEnd: (aborted, data) => {
            write(endString)
            return ps.onEnd(aborted, data)
        },
    }
}