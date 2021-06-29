/* eslint
    no-console: "off",
*/
import * as p20 from "pareto-20"
import * as p from "pareto"
import * as astn from "../src";
import { dummyParserEventConsumer } from "./dummyParserEventConsumer";
import { createErrorStreamHandler } from "../src";

const parserStack = astn.createParserStack({
    onEmbeddedSchema: () => {
        return dummyParserEventConsumer
    },
    onSchemaReference: () => {
        return p.value(null)
    },
    onBody: () => {
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
                return p.value(null)
            },
        }
    },
    errorStreams: createErrorStreamHandler(true, str => console.error(str)),
})

//let counter = 0

// function pause(pauser: astn.Pauser) {
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
        parserStack
    )
}

doIt()