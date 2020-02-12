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
    onlinecomment: (comment, range) => {
    },
    onblockcomment: (v, indent, range) => {
        //indent can be used to strip the leading whitespace of all lines of the block comment.
        //indent indicates the indentation string found up to the `/*` characters.
        //this is only provided if the block comment starts on a new line
    },
    onsimplevalue: (value, range) => {
    },
    onopentaggedunion: (location) => {
    },
    onclosetaggedunion: () => {
    },
    onoption: (option, range) => {
    },
    onopenarray: (startLocation, openCharacter) => {
    },
    onclosearray: (endLocation, closeCharacter) => {
    },
    onopenobject: (startLocation, openCharacter) => {
    },
    oncloseobject: (endLocation, closeCharacter) => {
    },
    onkey: (key, range) => {
    },
    onend: () => {
    }
})
parser.onerror.subscribe(err => { console.error("FOUND ERROR", err.message) })
parser.write(data)
parser.end()
