import { JSONTests } from "./ownJSONTestset"
import { createAnnotator} from "../examples/annotater"
import { Parser } from "../src/Parser"

Object.keys(JSONTests).forEach(testName => {
    console.log(">", testName)
    const test = JSONTests[testName]
    const parser = new Parser()
    parser.ondata.subscribe(createAnnotator("", str => console.log(str)))
    parser.onerror.subscribe(err => console.error(err))
    parser.write(test.text)
    parser.end()
})