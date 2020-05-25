/* eslint
    no-console:"off",
    complexity: "off",
*/
import * as p from "pareto"
import * as bc from "../src"
import { describe } from "mocha"
import * as chai from "chai"
import { JSONTests } from "./ownJSONTestset"
import { extensionTests } from "./JSONExtenstionsTestSet"
import { EventDefinition, TestRange, TestLocation, TestDefinition } from "./testDefinition"
import { createStackedDataSubscriber, ValueHandler, RequiredValueHandler, ParserEventType, IParserEventConsumer } from "../src"
import { createStreamSplitter } from "../src/createStreamSplitter"
import { streamifyArray } from "../src/streamifyArray"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const DEBUG = false

const selectedJSONTests = Object.keys(JSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

// const selectedJSONTests: string[] = ["string chunk span"]
// const selectedExtensionTests: string[] = []

function createTestFunction(chunks: string[], test: TestDefinition, strictJSON: boolean) {
    const expectedEvents = test.events
    return function () {
        if (DEBUG) console.log("CHUNKS:", chunks)

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

        /*
        RECREATE THE ORIGINAL STRING
        */
        const out: string[] = []

        function serialize(str: string) {
            const escaped = JSON.stringify(str)
            return escaped.substring(1, escaped.length - 1) //remove quotes
        }
        const outputter: bc.IParserEventConsumer = {
            onData: data => {
                switch (data.type[0]) {
                    case ParserEventType.BlockComment: {
                        const $ = data.type[1]
                        out.push(`/*${$.comment}*/`)
                        break
                    }
                    case ParserEventType.CloseArray: {
                        const $ = data.type[1]
                        out.push($.closeCharacter)
                        break
                    }
                    case ParserEventType.CloseObject: {
                        const $ = data.type[1]
                        out.push($.closeCharacter)
                        break
                    }
                    case ParserEventType.Colon: {
                        out.push(":")
                        break
                    }
                    case ParserEventType.Comma: {
                        out.push(",")
                        break
                    }
                    case ParserEventType.LineComment: {
                        const $ = data.type[1]
                        out.push(`//${$.comment}`)
                        break
                    }
                    case ParserEventType.NewLine: {
                        out.push("\n")
                        break
                    }
                    case ParserEventType.OpenArray: {
                        const $ = data.type[1]
                        out.push($.openCharacter)
                        break
                    }
                    case ParserEventType.OpenObject: {
                        const $ = data.type[1]
                        out.push($.openCharacter)
                        break
                    }
                    case ParserEventType.SimpleValue: {
                        const $ = data.type[1]
                        if ($.quote !== null) {
                            out.push(`${$.quote}${serialize($.value)}${$.terminated ? $.quote : ""}`)
                        } else {
                            out.push($.value)
                        }
                        break
                    }
                    case ParserEventType.TaggedUnion: {
                        out.push("|")
                        break
                    }
                    case ParserEventType.WhiteSpace: {
                        const $ = data.type[1]
                        out.push($.value)
                        break
                    }
                    default:
                        assertUnreachable(data.type[0])
                }
                return p.result(false)
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
        const eventSubscriber: bc.IParserEventConsumer = {
            onData: data => {
                switch (data.type[0]) {
                    case ParserEventType.BlockComment: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found block comment")
                        actualEvents.push(["token", "blockcomment", $.comment, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case ParserEventType.CloseArray: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found close array")
                        actualEvents.push(["token", "closearray", $.closeCharacter, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case ParserEventType.CloseObject: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found close object")
                        actualEvents.push(["token", "closeobject", $.closeCharacter, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case ParserEventType.Colon: {
                        break
                    }
                    case ParserEventType.Comma: {
                        break
                    }
                    case ParserEventType.LineComment: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found line comment")
                        actualEvents.push(["token", "linecomment", $.comment, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case ParserEventType.NewLine: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case ParserEventType.OpenArray: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found open array")
                        actualEvents.push(["token", "openarray", $.openCharacter, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case ParserEventType.OpenObject: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found open object")
                        actualEvents.push(["token", "openobject", $.openCharacter, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case ParserEventType.SimpleValue: {
                        const $ = data.type[1]
                        if ($.quote === null) {
                            if (DEBUG) console.log("found unquoted token")
                            actualEvents.push(["token", "unquotedtoken", $.value, getRange(test.testForLocation, data.range)])
                        } else {
                            if (DEBUG) console.log("found quoted string")
                            actualEvents.push(["token", "quotedstring", $.value, getRange(test.testForLocation, data.range)])
                        }
                        break
                    }
                    case ParserEventType.TaggedUnion: {
                        //const $ = data.type[1]

                        if (DEBUG) console.log("found open tagged union")
                        actualEvents.push(["token", "opentaggedunion", getRange(test.testForLocation, data.range)])
                        break
                    }
                    case ParserEventType.WhiteSpace: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    default:
                        assertUnreachable(data.type[0])
                }
                return p.result(false)
            },
            onEnd: (_aborted, location) => {
                if (DEBUG) console.log("found end")
                actualEvents.push(["end", getLocation(test.testForLocation, location)])
                if (expectedEvents !== undefined) {
                    chai.assert.deepEqual(actualEvents, expectedEvents)
                }
            },
        }

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
        const schemaDataSubscribers: IParserEventConsumer[] = [
            outputter,
            eventSubscriber,
            formatter,
        ]
        const instanceDataSubscribers: IParserEventConsumer[] = [
            outputter,
            eventSubscriber,
            stackedSubscriber,
            formatter,
        ]
        type HeaderSubscriber = {
            onHeaderStart(range: bc.Range): void
            onCompact(range: bc.Range): void
            onHeaderEnd(range: bc.Range): void
        }
        const headerSubscribers: HeaderSubscriber[] = [
            {
                onHeaderStart: () => {
                    out.push("!")
                    return []
                },
                onCompact: () => {
                    out.push("#")
                },
                onHeaderEnd: () => {
                    return []
                },
            },
        ]

        if (test.testHeaders) {
            headerSubscribers.push({
                onHeaderStart: _range => {
                    actualEvents.push(["token", "headerstart"])
                },
                onHeaderEnd: () => {
                    actualEvents.push(["headerend"])
                },
                onCompact: () => {
                    actualEvents.push(["token", "compact"])
                },
            })
        }
        if (strictJSON) {
            headerSubscribers.push(bc.createStrictJSONHeaderValidator((v, _range) => {
                actualEvents.push(["validationerror", v])
            }))
            instanceDataSubscribers.push(bc.createStrictJSONValidator((v, _range) => {
                if (DEBUG) console.log("found JSON validation error", v)
                actualEvents.push(["validationerror", v])
            }))
        }
        const parser = bc.createParser(
            (message, _range) => {
                if (DEBUG) console.log("found error")
                actualEvents.push(["parsererror", message])
            },
            {
                onHeaderStart: range => {
                    headerSubscribers.forEach(s => {
                        s.onHeaderStart(range)
                    })
                    return createStreamSplitter(schemaDataSubscribers)
                },
                onCompact: range => {
                    headerSubscribers.forEach(s => {
                        s.onCompact(range)
                    })
                },
                onHeaderEnd: range => {
                    headerSubscribers.forEach(s => {
                        s.onHeaderEnd(range)
                    })
                    return createStreamSplitter(instanceDataSubscribers)
                },
            },
        )

        streamifyArray(
            chunks,
            null,
            null,
            bc.createTokenizer(
                parser,
                (message, _location) => {
                    if (DEBUG) console.log("found error")

                    actualEvents.push(["tokenizererror", message])
                },
            )
        )
    }
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
