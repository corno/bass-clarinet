/* eslint
    no-console:"off",
*/
import { JSONTests } from "./ownJSONTestset"
import { createAnnotator} from "../examples/annotater"
import * as bc from "../src"

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = new bc.Parser(
        err => console.error(err),
        {}
    )
    parser.ondata.subscribe(createAnnotator("", str => console.log(str)))
    bc.tokenizeString(
        parser,
        err => console.error(err),
        test.text
    )
})