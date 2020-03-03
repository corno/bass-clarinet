import * as bc from "../src"
import * as fs from "fs"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, { encoding: "utf-8" })

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
)
const ec = new bc.ExpectContext(
    (_message, _range) => {
        throw new Error("encounterd error")
    },
    (_message, _range) => {
        throw new Error("encounterd warning")
    }
)

/**
 * expect an object/type with 2 properties, 'prop a' and 'prop b', both numbers
 */
parser.ondata.subscribe(bc.createStackedDataSubscriber(
    ec.expectType(
        (_range, _comments) => {
            //prepare code here
        },
        {
            "prop a": {
                onExists: (_propRange, _propComments) => ec.expectNumber((_value, _range, _comments) => {
                    //handle 'prop a'
                }),
                onNotExists: null,
            },
            "prop b": {
                onExists: () => ec.expectNumber(_value => {
                    //handle 'prop b'
                }),
                onNotExists: null,
            },
        },
        (_hasErrors, _range, _comments) => {
            //wrap up the object
        }
    ),
    error => {
        if (error.context[0] === "range") {
            throw new bc.RangeError(error.message, error.context[1])
        } else {
            throw new bc.LocationError(error.message, error.context[1])
        }
    },
    _comments => {
        //wrap up the document
    }
))

bc.tokenizeString(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    data
)
