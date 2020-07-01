import * as bc from "../src"
import * as p from "pareto"
import * as p20 from "pareto-20"
import * as fs from "fs"
import { ParserEventConsumer } from "../src"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

export const parserEventConsumer: ParserEventConsumer<null, null> = {
    onData: data => {
        switch (data.type[0]) {
            case bc.BodyEventType.CloseArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.CloseObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.Colon: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.Comma: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.OpenArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.OpenObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.Overhead: {
                const $ = data.type[1]
                switch ($.type[0]) {
                    case bc.OverheadTokenType.BlockComment: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case bc.OverheadTokenType.LineComment: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case bc.OverheadTokenType.NewLine: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case bc.OverheadTokenType.WhiteSpace: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case bc.BodyEventType.SimpleValue: {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case bc.BodyEventType.TaggedUnion: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return p.result(false)
    },
    onEnd: () => {
        //place your code here
        return p.success(null)
    },
}
const parser = bc.createParser(
    () => {
        return parserEventConsumer
    },
    () => {
        return parserEventConsumer
    },
    err => { console.error("FOUND PARSER ERROR", err) },
    () => {
        return p.result(false)
    }
)

const st = bc.createStreamPreTokenizer(
    bc.createTokenizer(parser),
    err => { console.error("FOUND TOKENIZER ERROR", err) },
)

p20.createArray([dataAsString]).streamify().handle(
    null,
    st
)
