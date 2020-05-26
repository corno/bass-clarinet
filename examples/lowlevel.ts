import * as bc from "../src"
import * as p from "pareto"
import * as p20 from "../src/streamifyArray"
import * as fs from "fs"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

export const parserEventConsumer: bc.IParserEventConsumer = {
    onData: data => {
        switch (data.type[0]) {
            case bc.ParserEventType.BlockComment: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.CloseArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.CloseObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.Colon: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.Comma: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.LineComment: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.NewLine: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.OpenArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.OpenObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.SimpleValue: {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case bc.ParserEventType.TaggedUnion: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.ParserEventType.WhiteSpace: {
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
    },
}
const parser = bc.createParser(
    err => { console.error("FOUND PARSER ERROR", err) },
    {
        onHeaderStart: () => {
            return parserEventConsumer
        },
        onCompact: () => {
            //
        },
        onHeaderEnd: () => {
            return parserEventConsumer
        },
    },
)

p20.streamifyArray(
    [dataAsString],
    null,
    null,
    bc.createStreamTokenizer(
        parser,
        err => { console.error("FOUND TOKENIZER ERROR", err) },
    )
)