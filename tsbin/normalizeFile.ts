import * as fs from "fs"
import { normalize } from "../src/normalize"
import * as p from "pareto"
import { Writable } from "stream"

const [, , sourcePath, targetPath] = process.argv


if (sourcePath === undefined) {
    console.error("missing source path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(sourcePath, { encoding: "utf-8" })


normalize(
    dataAsString,
    true,
).handle(
    () => {
        console.error(`an error occured. the error message is hopefully logged above this line`)
    },
    stream => {

        const ws: Writable = targetPath !== undefined
            ? fs.createWriteStream(targetPath, { encoding: "utf-8" })
            : process.stdout

        stream.handle(
            null,
            {
                onData: line => {
                    ws.write(line)
                    return p.value(false)
                },
                onEnd: () => {
                    ws.end()
                },
            }
        )
    }
)
