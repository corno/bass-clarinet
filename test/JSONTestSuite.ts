import * as fs from "fs"
import { describe } from "mocha"
import assert from "assert"
import * as path from "path"
import * as p from "../src/CParser"

const parsingDir = path.join(__dirname, "/../../JSONTestSuite/test_parsing")
describe('parsing', () => {
    fs.readdirSync(parsingDir).forEach(file => {
        it(file, () => {
            const expected = file[0]
            switch (expected) {
                case "n": {

                    try {
                        let foundError = false
                        const data = fs.readFileSync(path.join(parsingDir, file), { encoding: "utf-8" })
                        const parser = p.parser({})
                        parser.subscribe("error", () => {
                            foundError = true
                        })
                        parser.write(data)
                        parser.write(null)

                        assert.ok(foundError, "no errors found")
                    } catch (e) {
                        //nothing to do
                    }
                    break
                }
                case "y": {
                    try {
                        let foundError = false
                        const data = fs.readFileSync(path.join(parsingDir, file), { encoding: "utf-8" })
                        const parser = p.parser({})
                        parser.subscribe("error", () => {
                            foundError = true
                        })
                        parser.write(data)
                        parser.write(null)
                        assert.ok(!foundError, "errors found")
                    } catch (e) {
                    }
                    break
                }
                case "i":
                    try {
                        const data = fs.readFileSync(path.join(parsingDir, file), { encoding: "utf-8" })
                        const parser = p.parser({})
                        parser.subscribe("error", () => {
                        })
                        parser.write(data)
                        parser.write(null)
                    } catch (e) {
                    }
                    break
                default:
                    console.log("unknown expected result: " + expected)
            }
        })
    })
})

const transformDir = path.join(__dirname, "/../../JSONTestSuite/test_transform")
describe('transform', () => {
    fs.readdirSync(transformDir).forEach(file => {
        it(file, () => {
            try {
                const data = fs.readFileSync(path.join(transformDir, file), { encoding: "utf-8" })
                const parser = p.parser({})
                parser.subscribe("error", () => {
                })
                parser.write(data)
                parser.write(null)
            } catch (e) {
            }
        })
    })
})
