import * as normalize from "../src/normalize"
import * as fs from "fs"
import * as p from "pareto"
import * as chai from "chai"


const before = fs.readFileSync("./test/data/normalize/before.astn", { encoding: "utf-8"})
const after = fs.readFileSync("./test/data/normalize/after.astn", { encoding: "utf-8"})


describe('normalize', () => {
    it("normalize", () => {

        return normalize.normalize(before, true).try(
            stream => {
                const out: string[] = []
                return stream.consume<string, null>(null, {
                    onData: chunk => {
                        out.push(chunk)
                        return p.value(false)
                    },
                    onEnd: () => {
                        return p.success(out.join(``))
                    },
                })
            }
        ).convertToNativePromise(
            () => {
                return `unexpected error`
            },
        ).then(actualAfter => {
            fs.writeFileSync("./test/data/normalize/actualAfter.astn", actualAfter, { encoding: "utf-8"})
            chai.assert.equal(actualAfter, after)
        })
    })
})