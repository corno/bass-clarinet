import * as bc from "../src"
import * as fs from "fs"
import { DataType } from "../src"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })


const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
)
parser.ondata.subscribe({
    onData: data => {
        switch (data.type[0]) {
            case DataType.BlockComment: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.CloseArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.CloseObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.Colon: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.Comma: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.LineComment: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.NewLine: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.OpenArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.OpenObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.SimpleValue: {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case DataType.TaggedUnion: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.WhiteSpace: {
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
})

bc.tokenizeString(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    dataAsString,
)
