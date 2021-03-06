// import * as fs from "fs"
import * as fs from "fs"
import * as chai from "chai"
import * as astn from "../src"
import * as core from "astn-core"
import { consumeString } from "./consumeString"

const dir = "./test/data/formatting/"

const dataIn = fs.readFileSync(dir + "in.astn", { encoding: "utf-8" })

function format(
    formatter: core.Formatter<astn.TokenizerAnnotationData, null>,
    outBasename: string,
    outExtension: string
): Promise<null | void> {

    let actualOut = ""

    const expectedOut = fs.readFileSync(dir + outBasename + ".expected." + outExtension, { encoding: "utf-8" })

    const astnFormatter = astn.createASTNTextFormatter(
        formatter,
        "\r\n",
        str => {
            actualOut += str
        },
    )

    return consumeString(
        dataIn,
        astnFormatter,
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
        return format(core.createASTNNormalizer<astn.TokenizerAnnotationData, null>("    ", "\r\n"), "normalized", "astn")
    })
    it("JSON", () => {
        return format(core.createJSONFormatter<astn.TokenizerAnnotationData, null>("    ", "\r\n"), "out", "json")
    })
})