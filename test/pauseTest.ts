/* eslint
    no-console: "off",
*/
import * as p20 from "pareto-20"
import * as p from "pareto"
import * as bc from "../src";
import { dummyParserEventConsumer } from "./dummyConsumers";

const parser = bc.createParser(
    () => {
        return dummyParserEventConsumer
    },
    () => {
        return {
            onData: _data => {
                //return p20.result(false)

                return p20.wrapSafeFunction(onResult => {
                    setTimeout(
                        () => {
                            onResult(false)
                        },
                        1000
                    )
                })
            },
            onEnd: () => {
                console.log("Reached end")
                return p.success<null, null>(null)
            },
        }
    },
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


//2 strings:
const chunks = [
    `[
    "A", "B", "C"`,
    `]`,
]


export function doIt(): void {
    p20.createArray(chunks).streamify().handle(
        null,
        bc.createStreamPreTokenizer(
            parser,
            err => { console.error("FOUND TOKENIZER ERROR", err) },
        )
    )
}

doIt()