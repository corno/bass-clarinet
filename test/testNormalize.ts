// import * as fs from "fs"
import * as p from "pareto"
import * as fs from "fs"
import * as chai from "chai"
import * as astn from "../src"

const dataIn = fs.readFileSync("./test/data/formatting/in.astn", { encoding: "utf-8" })
const expectedOut = fs.readFileSync("./test/data/formatting/out.expected.astn", { encoding: "utf-8" })

describe('normalize', () => {
    it("normalize", () => {

        let actualOut = ""

        const writeStream: p.IStreamConsumer<string, null, null> = {
            onData: str => {
                actualOut += str
                return p.value(false)
            },
            onEnd: () => {
                return p.value(null)
            },
        }

        return astn.formatASTNText(
            dataIn,
            astn.createASTNFormatter("    ", "\r\n"),
            writeStream,
        ).convertToNativePromise().then(() => {
            if (actualOut !== expectedOut) {
                fs.writeFileSync("./test/data/formatting/out.acutal.astn", actualOut, { encoding: "utf-8" })
            }
            //fs.writeFileSync("./test/data/normalize/actualAfter.astn", actualAfter, { encoding: "utf-8"})
            chai.assert.equal(expectedOut, actualOut)
        })
    })
})