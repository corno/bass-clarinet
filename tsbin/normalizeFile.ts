import * as fs from "fs"
import * as stream from "stream"
import * as p from "pareto"
import { normalize } from "../src"

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
    myStream => {

        const ws: stream.Writable = targetPath !== undefined
            ? fs.createWriteStream(targetPath, { encoding: "utf-8" })
            : process.stdout

        myStream.handle(
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
