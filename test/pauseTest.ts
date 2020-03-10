/* eslint
    no-console: "off",
*/
import * as bc from "../src";

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
)

let counter = 0

function pause(pauser: bc.Pauser) {
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
    onString: (_value, metaData) => {
        console.log("SIMPLE VALUE")
        pause(metaData.pauser)
    },
    onOpenTaggedUnion: (_range, pauser) => {
        pause(pauser)
    },
    onOpenArray: metaData => {
        console.log("OPEN ARRAY")
        pause(metaData.pauser)
    },
    onCloseArray: metaData => {
        console.log("CLOSE ARRAY")
        if (metaData.pauser !== undefined) {
            pause(metaData.pauser)
        }
    },
    onOpenObject: metaData => {
        pause(metaData.pauser)
    },
    onCloseObject: metaData => {
        if (metaData.pauser !== undefined) {
            pause(metaData.pauser)
        }
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