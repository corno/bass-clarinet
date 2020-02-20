import * as bc from "../src"
import * as fs from "fs"
import { ExpectContext, createStackedDataSubscriber, LocationError, RangeError } from "../src"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, { encoding: "utf-8" })

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err.message) },
    { allow: bc.lax }
)
const tokenizer = new bc.Tokenizer(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err.message) }
)

const ec = new ExpectContext(null, null)

/**
 * expect an object/type with 2 properties, 'prop a' and 'prop b', both numbers
 */
parser.ondata.subscribe(
    createStackedDataSubscriber(
        ec.expectType(
            {
                "prop a": ec.expectNumber((_value, _range, _comments) => {
                    //handle 'prop a'
                }),
                "prop b": ec.expectNumber(_value => {
                    //handle 'prop b'
                }),
            },
            _hasErrors => {
                //wrap up the object
            }
        ),
        error => {
            if (error.context[0] === "range") {
                throw new RangeError(error.message, error.context[1])
            } else {
                throw new LocationError(error.message, error.context[1])
            }
        },
        _comments => {
            //wrap up the document
        }
    )
)
tokenizer.write(data)
tokenizer.end()
