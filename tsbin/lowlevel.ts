import * as p from "pareto"
import * as p20 from "pareto-20"
import * as fs from "fs"
import * as astn from "../src"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

export const parserEventConsumer: astn.TextParserEventConsumer<null, null> = {
    onData: data => {
        switch (data.type[0]) {
            case astn.TreeEventType.CloseArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.TreeEventType.CloseObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.TreeEventType.Colon: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.TreeEventType.Comma: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.TreeEventType.OpenArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.TreeEventType.OpenObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.TreeEventType.Overhead: {
                const $ = data.type[1]
                switch ($.type[0]) {
                    case astn.OverheadTokenType.Comment: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case astn.OverheadTokenType.NewLine: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case astn.OverheadTokenType.WhiteSpace: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case astn.TreeEventType.SimpleValue: {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case astn.TreeEventType.TaggedUnion: {
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
