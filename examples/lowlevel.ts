import * as fs  from "fs"
import * as bc from "../src"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, {encoding: "utf-8"})

const parser = new bc.Parser({ allow: bc.lax})
parser.ondata.subscribe({
    onlinecomment: (_comment, _range) => {
    },
    onblockcomment: (_comment, _range, _indent) => {
        //indent can be used to strip the leading whitespace of all lines of the block comment.
        //indent indicates the indentation string found up to the `/*` characters.
        //this is only provided if the block comment starts on a new line
    },
    onsimplevalue: (_value, _range) => {
    },
    onopentaggedunion: (_location) => {
    },
    onclosetaggedunion: () => {
    },
    onoption: (_option, _range) => {
    },
    onopenarray: (_startLocation, _openCharacter) => {
    },
    onclosearray: (_endLocation, _closeCharacter) => {
    },
    onopenobject: (_startLocation, _openCharacter) => {
    },
    oncloseobject: (_endLocation, _closeCharacter) => {
    },
    onkey: (_key, _range) => {
    },
    onend: () => {
    }
})
parser.onerror.subscribe(err => { console.error("FOUND ERROR", err.message) })
parser.write(data)
parser.end()
