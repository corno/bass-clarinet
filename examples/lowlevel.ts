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
parser.ondata.subscribe({
    onComma: () => {
        //place your code here
    },
    onColon: () => {
        //place your code here
    },
    onLineComment: (_comment, _range) => {
        //place your code here
    },
    onBlockComment: (_comment, _range) => {
        //
    },
    onQuotedString: (_value, _role, _quote, _range) => {
        //place your code here
        //in strict JSON, only '"' is valid for _quote
    },
    onUnquotedToken: (_value, _range) => {
        //place your code here
        //in strict JSON, only "null", "true" or "false" are valid for _value
    },
    onOpenTaggedUnion: _range => {
        //place your code here
    },
    onCloseTaggedUnion: () => {
        //place your code here
    },
    onOpenArray: (_openCharacterRange, _openCharacter) => {
        //place your code here
    },
    onCloseArray: (_closeCharacterRange, _closeCharacter) => {
        //place your code here
    },
    onOpenObject: (_startRange, _openCharacter) => {
        //place your code here
    },
    onCloseObject: (_endRange, _closeCharacter) => {
        //place your code here
    },
    onEnd: () => {
        //place your code here
    },
    onNewLine: () => {
        //
    },
    onWhitespace: () => {
        //
    },
})

bc.tokenizeString(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    data,
)
