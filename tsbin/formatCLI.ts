import * as stream from "stream"
import * as core from "astn-core"
import { createASTNTextFormatter, TokenizerAnnotationData } from "../src"

export function formatCLI(
    formatter: core.Formatter<TokenizerAnnotationData, null>,
    endString: string,
): void {
    const astnFormatter = createASTNTextFormatter(
        formatter,
        endString,
        str => {
            process.stdout.write(str)
        },
    )

    process.stdin.setEncoding("utf-8")
    process.stdin.pipe(
        new stream.Writable({
            defaultEncoding: "utf-8",
            write: function (data, _encoding, callback) {
                astnFormatter.onData(data.toString()).handle(_aborted => {
                    callback()
                })
            },
        })
    ).on('finish', () => {
        astnFormatter.onEnd(false, null).handle(() => {
            //nothing to do
        })
    })
}