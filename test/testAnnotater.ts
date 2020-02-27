/* eslint
    no-console:"off",
*/
import { JSONTests } from "./ownJSONTestset"
import { attachAnnotator} from "../examples/annotater"
import * as bc from "../src"

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = new bc.Parser(
        err => console.error(err),
        {}
    )
    attachAnnotator(parser, "", str => console.log(str))
    bc.tokenizeString(
        parser,
        err => console.error(err),
        test.text
    )
})