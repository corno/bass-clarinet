/* eslint
    no-console:"off",
*/
import * as p20 from "pareto-20"
import { JSONTests } from "./ownJSONTestset"
import { createAnnotator } from "../examples/annotater"
import * as bc from "../src"

const annotater = createAnnotator("", str => console.log(str))

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = bc.createParser(
        () => {
            return annotater
        },
        () => {
            return annotater
        },
        err => console.error(err),

    )
    createAnnotator("", str => console.log(str))
    p20.createArray([test.text]).streamify().handle(
        null,
        bc.createStreamTokenizer(
            parser,
            err => console.error(err),
        )
    )
})