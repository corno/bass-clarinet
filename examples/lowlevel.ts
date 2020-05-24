import * as bc from "../src"
import * as fs from "fs"
import { ParserEventType, IParserEventConsumer } from "../src"
import { streamifyArray } from "../src/streamifyArray"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

export const parserEventConsumer: IParserEventConsumer = {
    onData: data => {
        switch (data.type[0]) {
            case ParserEventType.BlockComment: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.CloseArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.CloseObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.Colon: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.Comma: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.LineComment: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.NewLine: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.OpenArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.OpenObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.SimpleValue: {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case ParserEventType.TaggedUnion: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case ParserEventType.WhiteSpace: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return false
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

streamifyArray(
    [dataAsString],
    null,
    null,
    bc.createTokenizer(
        parser,
        err => { console.error("FOUND TOKENIZER ERROR", err) },
    )
)