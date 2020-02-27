/* eslint
    no-console: "off",
*/
import * as bc from "../src";
import { Pauser } from "../src/parserAPI";

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
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
    onNewLine: () => {
        //
    },
    onWhitespace: () => {
        //
    },
    onComma: (_, pauser) => {
        console.log("COMMA")
        pause(pauser)
    },
    onColon: (_, pauser) => {
        pause(pauser)
    },
    onLineComment: (_comment, _range, pauser) => {
        pause(pauser)
    },
    onBlockComment: (_comment, _range, pauser) => {
        pause(pauser)
    },
    onQuotedString: (_value, _quote, _range, _terminated, pauser) => {
        console.log("QUOTED")
        pause(pauser)
    },
    onUnquotedToken: (_value, _range) => {
        //
    },
    onOpenTaggedUnion: (_range, pauser) => {
        pause(pauser)
    },
    onCloseTaggedUnion: () => {
        //
    },
    onOption: (_option, _quote, _range, _terminated, pauser) => {
        pause(pauser)
    },
    onOpenArray: (_openCharacterRange, _openCharacter, pauser) => {
        console.log("OPEN ARRAY")
        pause(pauser)
    },
    onCloseArray: (_closeCharacterRange, _closeCharacter, pauser) => {
        console.log("CLOSE ARRAY")
        pause(pauser)
    },
    onOpenObject: (_startRange, _openCharacter, pauser) => {
        pause(pauser)
    },
    onCloseObject: (_endRange, _closeCharacter, pauser) => {
        pause(pauser)
    },
    onKey: (_key, _quote, _range, _terminated, pauser) => {
        pause(pauser)
    },
    onEnd: () => {
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