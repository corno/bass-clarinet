/* eslint
    no-console:"off",
*/
import { JSONTests } from "./ownJSONTestset"
import { createAnnotator} from "../examples/annotater"
import { Tokenizer, Parser } from "../src"

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = new Parser(
        err => console.error(err),
        {}
    )
    const tokenizer = new Tokenizer(
        parser,
        err => console.error(err),
    )
    parser.ondata.subscribe(createAnnotator("", str => console.log(str)))
    tokenizer.write(test.text)
    tokenizer.end()
})