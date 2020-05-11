/* eslint
    no-console:"off",
*/

import * as bc from "../src"
import { describe } from "mocha"
import * as chai from "chai"
import { JSONTests } from "./ownJSONTestset"
import { extensionTests } from "./JSONExtenstionsTestSet"
import { EventDefinition, TestRange, TestLocation, TestDefinition } from "./testDefinition"
import { createStackedDataSubscriber, ValueHandler, RequiredValueHandler } from "../src"

const DEBUG = false

const selectedJSONTests = Object.keys(JSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

// const selectedJSONTests: string[] = ["wrong inline formatting"]
// const selectedExtensionTests: string[] = []

function createTestFunction(chunks: string[], test: TestDefinition, strictJSON: boolean) {
    const expectedEvents = test.events
    return function () {
        if (DEBUG) console.log("CHUNKS:", chunks)
        const parser = new bc.Parser(
            (message, _range) => {
                if (DEBUG) console.log("found error")
                actualEvents.push(["parsererror", message])
            }
        )

        const actualEvents: EventDefinition[] = []

        function getRange(mustCheck: boolean | undefined, range: bc.Range): TestRange | undefined {
            if (mustCheck) {
                return [
                    range.start.line,
                    range.start.column,
                    range.end.line,
                    range.end.column,
                ]
            } else {
                return undefined
            }
        }
        function getLocation(mustCheck: boolean | undefined, location: bc.Location): TestLocation | undefined {
            if (mustCheck) {
                return [
                    location.line,
                    location.column,
                ]
            } else {
                return undefined
            }
        }

        if (test.testHeaders) {
            parser.onheaderdata.subscribe({
                onHeaderStart: _range => {
                    if (DEBUG) console.log("found header start")
                    actualEvents.push(["token", "headerstart"])
                },
                onHeaderEnd: () => {
                    if (DEBUG) console.log("found header end")
                    actualEvents.push(["headerend"])
                },
                onCompact: () => {
                    if (DEBUG) console.log("found compact")
                    actualEvents.push(["token", "compact"])
                },
            })
        }

        /*
        RECREATE THE ORIGINAL STRING
        */
        const out: string[] = []

        function serialize(str: string) {
            const escaped = JSON.stringify(str)
            return escaped.substring(1, escaped.length - 1) //remove quotes
        }
        const outputter: bc.IDataSubscriber = {
            onComma: () => {
                out.push(",")
            },
            onColon: () => {
                out.push(":")
            },
            onLineComment: (comment, _range) => {
                out.push(`//${comment}`)
            },
            onBlockComment: (comment, _range) => {
                out.push(`/*${comment}*/`)
            },
            onString: (value, metaData) => {
                if (metaData.quote !== null) {
                    out.push(metaData.quote + serialize(value) + (metaData.terminated ? metaData.quote : ""))
                } else {
                    out.push(value)
                }
            },
            onOpenTaggedUnion: _range => {
                out.push("|")
            },
            onOpenArray: metaData => {
                out.push(metaData.openCharacter)
            },
            onCloseArray: metaData => {
                out.push(metaData.closeCharacter)
            },
            onOpenObject: metaData => {
                out.push(metaData.openCharacter)
            },
            onCloseObject: metaData => {
                out.push(metaData.closeCharacter)
            },
            onNewLine: () => {
                out.push("\n")
            },
            onWhitespace: value => {
                out.push(value)
            },
            //do the check
            onEnd: () => {
                if (!test.skipRoundTripCheck) {
                    chai.assert.equal(out.join(""), chunks.join("")
                        .replace(/\r\n/g, "\n")
                        .replace(/\n\r/g, "\n")
                        .replace(/\r/g, "\n")
                    )
                }
            },
        }
        parser.onschemadata.subscribe(outputter)
        parser.onheaderdata.subscribe({
            onHeaderStart: () => {
                out.push("!")
            },
            onCompact: () => {
                out.push("#")
            },
            onHeaderEnd: () => {
                //
            },
        })
        parser.ondata.subscribe(outputter)

        if (strictJSON) {
            bc.attachStrictJSONValidator(parser, (v, _range) => {
                if (DEBUG) console.log("found JSON validation error", v)
                actualEvents.push(["validationerror", v])
            })
        }

        function createTestRequiredValueHandler(): RequiredValueHandler {
            return {
                valueHandler: createTestValueHandler(),
                onMissing: () => {
                    actualEvents.push(["stacked error", "missing value"])

                },
            }
        }
        function createTestValueHandler(): ValueHandler {
            return {
                array: () => {
                    return {
                        element: () => {
                            return createTestValueHandler()
                        },
                        end: () => {
                            //
                        },
                    }
                },
                object: () => {
                    return {
                        property: () => {
                            return createTestRequiredValueHandler()
                        },
                        end: () => {
                            //
                        },
                    }

                },
                simpleValue: () => {
                    //
                },
                taggedUnion: () => {
                    return {
                        missingOption: () => {
                            //
                        },
                        option: () => {
                            return createTestRequiredValueHandler()
                        },
                    }
                },
            }
        }

        const stackedSubscriber = createStackedDataSubscriber(
            createTestRequiredValueHandler(),
            error => {
                actualEvents.push(["stacked error", error.rangeLessMessage])
            },
            () => {
                //
            }
        )
        const eventSubscriber: bc.IDataSubscriber = {
            onComma: () => {
                //
            },
            onColon: () => {
                //
            },
            onNewLine: () => {
                //
            },
            onWhitespace: () => {
                //
            },
            onLineComment: (v, metaData) => {
                if (DEBUG) console.log("found line comment")
                actualEvents.push(["token", "linecomment", v, getRange(test.testForLocation, metaData.outerRange)])
            },
            onBlockComment: (v, metaData) => {
                if (DEBUG) console.log("found block comment")
                actualEvents.push(["token", "blockcomment", v, getRange(test.testForLocation, metaData.outerRange)])
            },
            onString: (v, metaData) => {
                if (metaData.quote === null) {
                    if (DEBUG) console.log("found unquoted token")
                    actualEvents.push(["token", "unquotedtoken", v, getRange(test.testForLocation, metaData.range)])
                } else {
                    if (DEBUG) console.log("found quoted string")
                    actualEvents.push(["token", "quotedstring", v, getRange(test.testForLocation, metaData.range)])
                }
            },

            onOpenTaggedUnion: metaData => {
                if (DEBUG) console.log("found open tagged union")
                actualEvents.push(["token", "opentaggedunion", getRange(test.testForLocation, metaData.range)])
            },
            onOpenArray: metaData => {
                if (DEBUG) console.log("found open array")
                actualEvents.push(["token", "openarray", metaData.openCharacter, getRange(test.testForLocation, metaData.range)])
            },
            onCloseArray: metaData => {
                if (DEBUG) console.log("found close array")
                actualEvents.push(["token", "closearray", metaData.closeCharacter, getRange(test.testForLocation, metaData.range)])
            },
            onOpenObject: metaData => {
                if (DEBUG) console.log("found open object")
                actualEvents.push(["token", "openobject", metaData.openCharacter, getRange(test.testForLocation, metaData.range)])
            },
            onCloseObject: metaData => {
                if (DEBUG) console.log("found close object")
                actualEvents.push(["token", "closeobject", metaData.closeCharacter, getRange(test.testForLocation, metaData.range)])
            },
            onEnd: location => {
                if (DEBUG) console.log("found end")
                actualEvents.push(["end", getLocation(test.testForLocation, location)])
                chai.assert.deepEqual(actualEvents, expectedEvents)
            },
        }
        parser.onschemadata.subscribe(eventSubscriber)
        parser.ondata.subscribe(eventSubscriber)
        parser.ondata.subscribe(stackedSubscriber)

        let formattedText = test.text
        let offset = 0

        const formatter = bc.createFormatter(
            (range, newValue) => {
                formattedText =
                    formattedText.substr(0, offset + range.start.position) +
                    newValue +
                    formattedText.substr(offset + range.end.position)
                offset +=
                    + newValue.length
                    - range.end.position
                    + range.start.position
            },
            range => {
                formattedText =
                    formattedText.substr(0, offset + range.start.position) +
                    formattedText.substr(offset + range.end.position)
                offset +=
                    - range.end.position
                    + range.start.position
            },
            (location, value) => {
                formattedText =
                    formattedText.substr(0, offset + location.position) +
                    value +
                    formattedText.substr(offset + location.position)
                offset += value.length
            },
            () => {

                const expectedFormattedText = test.formattedText ? test.formattedText : test.text
                chai.assert.equal(
                    formattedText
                        .replace(/\r\n/g, "\n")
                        .replace(/\n\r/g, "\n")
                        .replace(/\r/g, "\n"),
                    expectedFormattedText
                )
            },
        )
        parser.ondata.subscribe(formatter)
        parser.onschemadata.subscribe(formatter)

        bc.tokenizeStrings(
            parser,
            (message, _location) => {
                if (DEBUG) console.log("found error")

                actualEvents.push(["tokenizererror", message])
            },
            chunks
        )
    };
}

type Offset = {
    position: number
    offset: number
}

describe('bass-clarinet', () => {
    describe('#strictJSON', () => {
        selectedJSONTests.forEach(key => {
            const test = JSONTests[key]
            it('[' + key + '] should be able to parse -> one chunk', createTestFunction([test.text], test, true));
            it('[' + key + '] should be able to parse -> every character is a chunck', createTestFunction(test.text.split(''), test, true));
        })
    })
    describe('#extensions', () => {
        selectedExtensionTests.forEach(key => {
            const test = extensionTests[key]
            it('[' + key + '] should be able to parse -> one chunk', createTestFunction([test.text], test, false));
            it('[' + key + '] should be able to parse -> every character is a chunck', createTestFunction(test.text.split(''), test, false));
        })
    });

    describe('#pre-chunked', () => {
        selectedJSONTests.forEach(key => {
            const test = JSONTests[key]
            if (!test.chunks) return;
            it('[' + key + '] should be able to parse pre-chunked', createTestFunction(test.chunks, test, true));
        })
    });
});
