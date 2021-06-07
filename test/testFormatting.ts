// import * as fs from "fs"
import * as fs from "fs"
import * as chai from "chai"
import * as astn from "../src"
import * as core from "astn-core"

const dir = "./test/data/formatting/"

const dataIn = fs.readFileSync(dir + "in.astn", { encoding: "utf-8" })

function format(
    formatter: core.Formatter<astn.ParserAnnotationData, null>,
    outBasename: string,
    outExtension: string
): Promise<null | void> {

    let actualOut = ""

    const expectedOut = fs.readFileSync(dir + outBasename + ".expected." + outExtension, { encoding: "utf-8" })

    return astn.formatASTNText(
        dataIn,
        formatter,
        str => {
            actualOut += str
        },
    ).convertToNativePromise().then(() => {
        if (actualOut !== expectedOut) {
            fs.writeFileSync(dir + outBasename + ".actual." + outExtension, actualOut, { encoding: "utf-8" })
        }
        //fs.writeFileSync("./test/data/formatting/actualAfter.astn", actualAfter, { encoding: "utf-8"})
        chai.assert.equal(expectedOut, actualOut)
    })
}

describe('formatting', () => {
    it("normalized ASTN", () => {
        return format(core.createASTNNormalizer<astn.ParserAnnotationData, null>("    ", "\r\n"), "normalized", "astn")
    })
    it("JSON", () => {
        return format(core.createJSONFormatter<astn.ParserAnnotationData, null>("    ", "\r\n"), "out", "json")
    })
})