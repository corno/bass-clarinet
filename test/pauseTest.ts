/* eslint
    no-console: "off",
*/
import * as p20 from "pareto-20"
import * as bc from "../src";
import { DataType } from "../src";

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
)

//let counter = 0

// function pause(pauser: bc.Pauser) {
//     counter += 1
//     console.log("pausing", counter)
//     pauser.pause()
//     //console.log("paused", counter)
//     setTimeout(() => {
//         console.log("continuing", counter)
//         pauser.continue()
//         //console.log("continued", counter)
//         counter -= 1
//     }, 500)
// }

parser.ondata.subscribe({
    onData: data => {
        switch (data.type[0]) {
            case DataType.BlockComment: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case DataType.CloseArray: {
                break
            }
            case DataType.CloseObject: {
                break
            }
            case DataType.Colon: {
                console.log("COLON")
                break
            }
            case DataType.Comma: {
                console.log("COMMA")
                break
            }
            case DataType.LineComment: {
                break
            }
            case DataType.NewLine: {
                break
            }
            case DataType.OpenArray: {
                break
            }
            case DataType.OpenObject: {
                break
            }
            case DataType.SimpleValue: {
                break
            }
            case DataType.TaggedUnion: {
                break
            }
            case DataType.WhiteSpace: {
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return p20.wrapSafeFunction(onResult => {
            setInterval(
                () => {
                    onResult(false)
                },
                1
            )
        })
    },
    onEnd: () => {
        console.log("Reached end")
    },
})


bc.tokenizeStrings(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    [
        `[
        "A", "B", "C"`,
        `]`,
    ]
)