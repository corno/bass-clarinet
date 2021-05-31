/* eslint
    no-console:"off",
    complexity: "off",
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as p20 from "pareto-20"
import * as astn from "../src"
import { describe } from "mocha"
import * as chai from "chai"
import { ownJSONTests } from "./data/ownJSONTestset"
import { extensionTests } from "./data/ASTNTestSet"
import { EventDefinition, TestRange, TestLocation, TestDefinition } from "./TestDefinition"
import { getEndLocationFromRange, ParserAnnotationData } from "../src"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const DEBUG = false

const selectedOwnJSONTests = Object.keys(ownJSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

// const selectedJSONTests: string[] = []
// const selectedExtensionTests: string[] = ["comment"]

// type OnError = (message: string, range: astn.Range) => void

interface HeaderSubscriber {
    onSchemaDataStart(range: astn.Range): void
    onInstanceDataStart(location: astn.Location): void
}

function createTestFunction(chunks: string[], test: TestDefinition, _strictJSON: boolean) {
    return function () {
        if (DEBUG) console.log("CHUNKS:", chunks)

        const actualEvents: EventDefinition[] = []

        function getRange(mustCheck: boolean | undefined, range: astn.Range): TestRange | null {
            if (mustCheck) {
                const end = astn.getEndLocationFromRange(range)
                return [
                    range.start.line,
                    range.start.column,
                    end.line,
                    end.column,
                ]
            } else {
                return null
            }
        }
        function getLocation(mustCheck: boolean | undefined, location: astn.Location): TestLocation | null {
            if (mustCheck) {
                return [
                    location.line,
                    location.column,
                ]
            } else {
                return null
            }
        }

        /*
        RECREATE THE ORIGINAL STRING
        */

        function createTestRequiredValueHandler(): astn.ParserRequiredValueHandler {
            return {
                exists: createTestValueHandler(),
                missing: () => {
                    actualEvents.push(["stacked error", "missing value"])
                },
            }
        }
        function createTestTreeHandler(): astn.ParserTreeHandler {
            return {
                root: createTestRequiredValueHandler(),
            }
        }
        function createTestValueHandler(): astn.ParserValueHandler {
            return {
                array: () => {
                    return {
                        element: () => {
                            return createTestValueHandler()
                        },
                        arrayEnd: () => {
                            //
                            return p.value(null)
                        },
                    }
                },
                object: () => {
                    return {
                        property: () => {
                            return p.value(createTestRequiredValueHandler())
                        },
                        objectEnd: () => {
                            //
                            return p.value(null)
                        },
                    }

                },
                string: () => {
                    return p.value(false)
                },
                taggedUnion: () => {
                    return {
                        missingOption: () => {
                            //
                        },
                        option: () => {
                            return createTestRequiredValueHandler()
                        },
                        end: () => {
                            //
                        },
                    }
                },
            }
        }

        const stackedSubscriber = astn.createStackedParser(
            createTestTreeHandler(),
            error => {

                actualEvents.push(["stacked error", astn.printStackedDataError(error)])
            },
            () => {
                return p.success<null, null>(null)
            }
        )
        const eventSubscriber: astn.ITreeParserEventConsumer<ParserAnnotationData, null, null> = {
            onData: data => {
                switch (data.type[0]) {
                    case astn.TreeEventType.CloseArray: {
                        if (DEBUG) console.log("found close array")
                        actualEvents.push(["token", "closearray", data.annotation.tokenString, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case astn.TreeEventType.CloseObject: {
                        if (DEBUG) console.log("found close object")
                        actualEvents.push(["token", "closeobject", data.annotation.tokenString, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case astn.TreeEventType.OpenArray: {
                        if (DEBUG) console.log("found open array")
                        actualEvents.push(["token", "openarray", data.annotation.tokenString, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case astn.TreeEventType.OpenObject: {
                        if (DEBUG) console.log("found open object")
                        actualEvents.push(["token", "openobject", data.annotation.tokenString, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case astn.TreeEventType.StringValue: {
                        const $ = data.type[1]
                        switch ($.type[0]) {
                            case "multiline": {
                                const $$ = $.type[1]
                                if (DEBUG) console.log("found wrapped string")
                                actualEvents.push(["token", "wrappedstring", $$.lines.join("\\n"), getRange(test.testForLocation, data.annotation.range)])

                                break
                            }
                            case "quoted": {
                                const $$ = $.type[1]
                                if (DEBUG) console.log("found wrapped string")
                                actualEvents.push(["token", "wrappedstring", $$.value, getRange(test.testForLocation, data.annotation.range)])

                                break
                            }
                            case "nonwrapped": {
                                const $$ = $.type[1]
                                if (DEBUG) console.log("found nonwrapped string")
                                actualEvents.push(["token", "nonwrappedstring", $$.value, getRange(test.testForLocation, data.annotation.range)])

                                break
                            }
                            default:
                                assertUnreachable($.type[0])
                        }
                        break
                    }
                    case astn.TreeEventType.Identifier: {
                        const $ = data.type[1]
                        actualEvents.push(["token", "wrappedstring", $.name, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case astn.TreeEventType.TaggedUnion: {
                        //const $ = data.type[1]

                        if (DEBUG) console.log("found open tagged union")
                        actualEvents.push(["token", "opentaggedunion", getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    default:
                        assertUnreachable(data.type[0])
                }
                return p.value(false)
            },
            onEnd: (_aborted, endData): p.IUnsafeValue<null, null> => {
                if (DEBUG) console.log("found end")
                actualEvents.push(["end", getLocation(test.testForLocation, getEndLocationFromRange(endData.range))])
                return p.success(null)
            },
        }

        let formattedText = test.text
        let offset = 0

        function createFormatter() {
            return astn.createFormatter(
                "    ",
                (range, newValue) => {
                    formattedText =
                        formattedText.substr(0, offset + range.start.position) +
                        newValue +
                        formattedText.substr(offset + astn.getEndLocationFromRange(range).position)
                    offset +=
                        + newValue.length
                        - range.length
                },
                range => {
                    formattedText =
                        formattedText.substr(0, offset + range.start.position) +
                        formattedText.substr(offset + range.start.position + range.length)
                    offset +=
                        - range.length
                },
                (location, value) => {
                    formattedText =
                        formattedText.substr(0, offset + location.position) +
                        value +
                        formattedText.substr(offset + location.position)
                    offset += value.length
                },
                () => {

                    return p.value(null)

                },
            )
        }
        const out: string[] = []
        const schemaDataSubscribers: astn.ITreeParserEventConsumer<ParserAnnotationData, null, null>[] = [
            eventSubscriber,
            createFormatter(),
        ]
        const instanceDataSubscribers: astn.ITreeParserEventConsumer<ParserAnnotationData, null, null>[] = [
            eventSubscriber,
            stackedSubscriber,
            createFormatter(),
        ]
        const headerSubscribers: HeaderSubscriber[] = [
            {
                onSchemaDataStart: () => {
                    out.push("!")
                    return []
                },
                onInstanceDataStart: () => {
                    return []
                },
            },
        ]

        if (test.testHeaders) {
            headerSubscribers.push({
                onSchemaDataStart: _range => {
                    actualEvents.push(["token", "schema data start"])
                },
                onInstanceDataStart: () => {
                    actualEvents.push(["instance data start"])
                },
            })
        }
        const parserStack = astn.createParserStack(
            range => {
                headerSubscribers.forEach(s => {
                    s.onSchemaDataStart(range)
                })
                return astn.createStreamSplitter(schemaDataSubscribers)
            },
            location => {
                headerSubscribers.forEach(s => {
                    s.onInstanceDataStart(location)
                })
                return astn.createStreamSplitter(instanceDataSubscribers)
            },
            (error, _location) => {
                if (DEBUG) console.log("found error")
                actualEvents.push(["parsingerror", astn.printParsingError(error)])


            },
            (_token, _range) => {
                return p.value(false)
            },
        )

        return p20.createArray(chunks).streamify().tryToConsume(
            null,
            parserStack,
        ).convertToNativePromise(() => "Error found").then(() => {
            //

            if (test.events !== undefined) {
                chai.assert.deepEqual(actualEvents, test.events)
            }
            //const expectedFormattedText = test.formattedText ? test.formattedText : test.text

            // if (!test.skipRoundTripCheck) {
            //     chai.assert.equal("roundtrip:\n" + out.join(""), "roundtrip:\n" + chunks.join("")
            //         .replace(/\r\n/g, "\n")
            //         .replace(/\n\r/g, "\n")
            //         .replace(/\r/g, "\n")
            //     )
            // }
            // chai.assert.equal(
            //     "formatted:\n" + formattedText
            //         .replace(/\r\n/g, "\n")
            //         .replace(/\n\r/g, "\n")
            //         .replace(/\r/g, "\n"),
            //     "formatted:\n" + expectedFormattedText
            // )
        })
    }
}

describe('astn', () => {
    describe('#strictJSON', () => {
        selectedOwnJSONTests.forEach(key => {
            const test = ownJSONTests[key]
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
        selectedOwnJSONTests.forEach(key => {
            const test = ownJSONTests[key]
            if (!test.chunks) return;
            it('[' + key + '] should be able to parse pre-chunked', createTestFunction(test.chunks, test, true));
        })
    });
});
