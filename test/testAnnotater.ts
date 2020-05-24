/* eslint
    no-console:"off",
*/
import { JSONTests } from "./ownJSONTestset"
import { createAnnotator } from "../examples/annotater"
import * as bc from "../src"
import { streamifyArray } from "../src/streamifyArray"

const annotater = createAnnotator("", str => console.log(str))

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = bc.createParser(
        err => console.error(err),
        {
            onHeaderStart: () => {
                return annotater
            },
            onCompact: () => {
                //
            },
            onHeaderEnd: () => {
                return annotater
            },
        },
    )
    createAnnotator("", str => console.log(str))
    streamifyArray(
        [test.text],
        null,
        null,
        bc.createTokenizer(
            parser,
            err => console.error(err),
        )
    )
})