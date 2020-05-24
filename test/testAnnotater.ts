/* eslint
    no-console:"off",
*/
import * as p20 from "pareto-20"
import { JSONTests } from "./ownJSONTestset"
import { attachAnnotator} from "../examples/annotater"
import * as bc from "../src"

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = new bc.Parser(
        err => console.error(err),
    )
    attachAnnotator(parser, "", str => console.log(str))
    bc.tokenizeStream(
        new p20.Stream(p20.streamifyArray([test.text], null)),
        parser,
        err => console.error(err),
    )
})