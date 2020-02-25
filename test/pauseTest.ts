/* eslint
    no-console: "off",
*/
import * as bc from "../src";
import { Pauser } from "../src/parserAPI";

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
    { allow: bc.lax }
)

let counter = 0

function pause(pauser: Pauser) {
    counter += 1
    console.log("pausing", counter)
    pauser.pause()
    //console.log("paused", counter)
    setTimeout(() => {
        console.log("continuing", counter)
        pauser.continue()
        //console.log("continued", counter)
        counter -= 1
    }, 500)
}

parser.ondata.subscribe({
    oncomma: (_, pauser) => {
        console.log("COMMA")
        pause(pauser)
    },
    oncolon: (_, pauser) => {
        pause(pauser)
    },
    onlinecomment: (_comment, _range, pauser) => {
        pause(pauser)
    },
    onblockcomment: (_comment, _range, _indent, pauser) => {
        pause(pauser)
    },
    onquotedstring: (_value, _quote, _range, pauser) => {
        console.log("QUOTED")
        pause(pauser)
    },
    onunquotedtoken: (_value, _range) => {
        //
    },
    onopentaggedunion: (_range, pauser) => {
        pause(pauser)
    },
    onclosetaggedunion: () => {
        //
    },
    onoption: (_option, _range, pauser) => {
        pause(pauser)
    },
    onopenarray: (_openCharacterRange, _openCharacter, pauser) => {
        console.log("OPEN ARRAY")
        pause(pauser)
    },
    onclosearray: (_closeCharacterRange, _closeCharacter, pauser) => {
        console.log("CLOSE ARRAY")
        pause(pauser)
    },
    onopenobject: (_startRange, _openCharacter, pauser) => {
        pause(pauser)
    },
    oncloseobject: (_endRange, _closeCharacter, pauser) => {
        pause(pauser)
    },
    onkey: (_key, _range, pauser) => {
        pause(pauser)
    },
    onend: () => {
        console.log("Reached end")
    },
})


bc.tokenizeStrings(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    [
        `[
        "A", "B", "C"`,
        `]`,
    ]
)