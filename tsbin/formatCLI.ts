import * as p from "pareto"
import * as fs from "fs"
import * as stream from "stream"
import { formatASTNText, ParserAnnotationData } from "../src"
import { Formatter } from "../src/formatting/Formatter"

export function formatCLI(
    formatter: Formatter<ParserAnnotationData, null>,
): void {

    const [, , sourcePath, targetPath] = process.argv

    const ws: stream.Writable = targetPath !== undefined
        ? fs.createWriteStream(targetPath, { encoding: "utf-8" })
        : process.stdout


    if (sourcePath === undefined) {
        console.error("missing path")
        process.exit(1)
    }

    const writeStream: p.IStreamConsumer<string, null, null> = {
        onData: str => {
            ws.write(str)
            return p.value(false)
        },
        onEnd: () => {
            ws.end()
            return p.value(null)
        },
    }

    const dataAsString = fs.readFileSync(sourcePath, { encoding: "utf-8" })
    formatASTNText(
        dataAsString,
        formatter,
        writeStream,
    ).handle(
        () => {
            //nothing to do
        }
    )
}