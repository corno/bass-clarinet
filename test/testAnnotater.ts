/* eslint
    no-console:"off",
*/
import * as p20 from "pareto-20"
import * as p from "pareto"
import { ownJSONTests } from "./data/ownJSONTestset"
import { createAnnotator } from "../examples/annotater"
import * as astn from "../src"

const annotater = createAnnotator("", str => console.log(str))

Object.keys(ownJSONTests).forEach(testName => {
    console.log(">", testName)
    const test = ownJSONTests[testName]
    const parserStack = astn.createParserStack(
        () => {
            return annotater
        },
        () => {
            return annotater
        },
        err => console.error(err),
        () => {
            return p.value(false)
        },

    )
    createAnnotator("", str => console.log(str))
    p20.createArray([test.text]).streamify().handle(
        null,
        parserStack,
    )
})