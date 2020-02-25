import * as bc from "../src"
import * as fs  from "fs"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, {encoding: "utf-8"})


const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
    { allow: bc.lax }
)
parser.ondata.subscribe({
    oncomma: () => {
        //place your code here
    },
    oncolon: () => {
        //place your code here
    },
    onlinecomment: (_comment, _range) => {
        //place your code here
    },
    onblockcomment: (_comment, _range, _indent) => {
        //indent can be used to strip the leading whitespace of all lines of the block comment.
        //indent indicates the indentation string found up to the `/*` characters.
        //this is only provided if the block comment starts on a new line
    },
    onquotedstring: (_value, _quote, _range) => {
        //place your code here
        //in pure JSON, only '"' is valid for _quote
    },
    onunquotedtoken: (_value, _range) => {
        //place your code here
        //in pure JSON, only "null", "true" or "false" are valid for _value
    },
    onopentaggedunion: _range => {
        //place your code here
    },
    onclosetaggedunion: () => {
        //place your code here
    },
    onoption: (_option, _range) => {
        //place your code here
    },
    onopenarray: (_openCharacterRange, _openCharacter) => {
        //place your code here
    },
    onclosearray: (_closeCharacterRange, _closeCharacter) => {
        //place your code here
    },
    onopenobject: (_startRange, _openCharacter) => {
        //place your code here
    },
    oncloseobject: (_endRange, _closeCharacter) => {
        //place your code here
    },
    onkey: (_key, _range) => {
        //place your code here
    },
    onend: () => {
        //place your code here
    },
})

bc.tokenizeString(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    data,
)
