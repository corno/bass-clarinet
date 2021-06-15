import * as fs from "fs"
import * as stream from "stream"
import * as core from "astn-core"
import { formatASTNText, ParserAnnotationData } from "../src"

export function formatCLI(
    formatter: core.Formatter<ParserAnnotationData, null>,
): void {

    const [, , sourcePath, targetPath] = process.argv

    const ws: stream.Writable = targetPath !== undefined
        ? fs.createWriteStream(targetPath, { encoding: "utf-8" })
        : process.stdout


    if (sourcePath === undefined) {
        console.error("missing path")
        process.exit(1)
    }

    const dataAsString = fs.readFileSync(sourcePath, { encoding: "utf-8" })
    formatASTNText(
        dataAsString,
        formatter,
        str => {
            ws.write(str)
        },
    ).handle(
        () => {
            ws.end()
            //nothing to do
        }
    )
}