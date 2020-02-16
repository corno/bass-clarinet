/* eslint
    no-console:"off",
*/
import { JSONTests } from "./ownJSONTestset"
import { createAnnotator} from "../examples/annotater"
import { Tokenizer, Parser } from "../src"

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = new Parser()
    const tokenizer = new Tokenizer(parser)
    parser.ondata.subscribe(createAnnotator("", str => console.log(str)))
    parser.onerror.subscribe(err => console.error(err))
    tokenizer.onerror.subscribe(err => console.error(err))
    tokenizer.write(test.text)
    tokenizer.end()
})