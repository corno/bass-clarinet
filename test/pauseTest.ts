/* eslint
    no-console: "off",
*/
import * as p20 from "pareto-20"
import * as bc from "../src";
import { dummyParserEventConsumer } from "./dummyConsumers";
import { streamifyArray } from "../src/streamifyArray";

const parser = bc.createParser(
    err => { console.error("FOUND PARSER ERROR", err) },

    {
        onHeaderStart: () => {
            return dummyParserEventConsumer
        },
        onCompact: () => {
            //
        },
        onHeaderEnd: () => {
            return {
                onData: _data => {
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
            }
        },
    },
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

const chunks = [
    `[
    "A", "B", "C"`,
    `]`,
]

streamifyArray(
    chunks,
    null,
    null,
    bc.createStreamTokenizer(
        parser,
        err => { console.error("FOUND TOKENIZER ERROR", err) },
    )
)