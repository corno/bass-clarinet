import { tests } from "./ownTestset"
import { createValuesAnnotater} from "./annotater"
import { Parser } from "../src/Parser"
import { subscribeStack } from "../src/subscribeStack"

Object.keys(tests).forEach(testName => {
    console.log(">", testName)
    const test = tests[testName]
    const parser = new Parser()
    subscribeStack(parser, createValuesAnnotater("", console.log))
    parser.write(test.text)
    parser.end()
})