/* eslint
    no-console: "off",
*/
import * as bc from "../src";

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err.message) },
    { allow: bc.lax }
)
const tokenizer = new bc.Tokenizer(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err.message) }
)

function pause() {
    console.log("pausing")
    tokenizer.pause()
    setTimeout(() => {
        console.log("continuing")
        tokenizer.continue()
    }, 10)
}

parser.ondata.subscribe({
    oncomma: () => {
        pause()
    },
    oncolon: () => {
        pause()
    },
    onlinecomment: (_comment, _range) => {
        pause()
    },
    onblockcomment: (_comment, _range, _indent) => {
        pause()
    },
    onquotedstring: (_value, _quote, _range) => {
        pause()
    },
    onunquotedtoken: (_value, _range) => {
        pause()
    },
    onopentaggedunion: _range => {
        pause()
    },
    onclosetaggedunion: () => {
        pause()
    },
    onoption: (_option, _range) => {
        pause()
    },
    onopenarray: (_openCharacterRange, _openCharacter) => {
        pause()
    },
    onclosearray: (_closeCharacterRange, _closeCharacter) => {
        pause()
    },
    onopenobject: (_startRange, _openCharacter) => {
        pause()
    },
    oncloseobject: (_endRange, _closeCharacter) => {
        pause()
    },
    onkey: (_key, _range) => {
        pause()
    },
    onend: () => {
        console.log("Reached end")

    },
})

tokenizer.write(`[
    "A", "B", "C"
]`)
tokenizer.onreadyforwrite.subscribe(() => {
    tokenizer.end()
})