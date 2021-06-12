import * as p from "pareto"
import * as p20 from "pareto-20"
import * as fs from "fs"
import * as astn from "../src"
import * as core from "astn-core"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

export const parserEventConsumer: core.ITreeBuilder<astn.ParserAnnotationData, null, null> = {
    onData: data => {
        switch (data.type[0]) {
            case "close array": {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case "close object": {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case "open array": {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case "open object": {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case "simple string": {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case "multiline string": {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case "tagged union": {
                //const $ = data.type[1]
                //place your code here
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return p.value(false)
    },
    onEnd: () => {
        //place your code here
        return p.success(null)
    },
}
const parserStack = astn.createParserStack(
    () => {
        return parserEventConsumer
    },
    () => {
        return parserEventConsumer
    },
    err => { console.error("FOUND ERROR", err) },
    () => {
        return p.value(false)
    }
)

p20.createArray([dataAsString]).streamify().handle(
    null,
    parserStack
)
