import { tests } from "./ownTestset"
import { createValuesAnnotater} from "../examples/annotater"
import { Parser } from "../src/Parser"
import { subscribeStack } from "../src/subscribeStack"

Object.keys(tests).forEach(testName => {
    console.log(">", testName)
    const test = tests[testName]
    const parser = new Parser()
    subscribeStack(parser, createValuesAnnotater("", str => console.log(str), true))
    parser.write(test.text)
    parser.end()
})