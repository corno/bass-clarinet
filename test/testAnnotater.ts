import { JSONTests } from "./ownJSONTestset"
import { createValuesAnnotater} from "../examples/annotater"
import { Parser } from "../src/Parser"
import { subscribeStack } from "../src/subscribeStack"

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = new Parser()
    subscribeStack(parser, createValuesAnnotater("", str => console.log(str)), err => console.error(err))
    parser.write(test.text)
    parser.end()
})