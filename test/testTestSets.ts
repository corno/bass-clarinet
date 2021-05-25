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
import { createStreamSplitter } from "../src/createStreamSplitter"
import { printParsingError, printStackedDataError } from "../src"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const DEBUG = false

const selectedOwnJSONTests = Object.keys(ownJSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

// const selectedJSONTests: string[] = []
// const selectedExtensionTests: string[] = ["comment"]

type OnError = (message: string, range: astn.Range) => void

interface HeaderSubscriber {
    onSchemaDataStart(range: astn.Range): void
    onInstanceDataStart(location: astn.Location): void
}

class StrictJSONHeaderValidator implements HeaderSubscriber {
    private readonly onError: OnError

    constructor(onError: OnError) {
        this.onError = onError
    }
    onSchemaDataStart(range: astn.Range) {
        this.onError(`headers are not allowed in strict JSON`, range)
    }
    onInstanceDataStart() {
        return astn.createStrictJSONValidator(this.onError)
    }
}

function outputOverheadToken(out: string[], $: astn.OverheadToken) {
    switch ($.type[0]) {
        case astn.OverheadTokenType.Comment: {
            const $$ = $.type[1]
            switch ($$.type) {
                case "block": {
                    out.push(`/*${$$.comment}*/`)

                    break
                }
                case "line": {
                    out.push(`//${$$.comment}`)

                    break
                }
                default:
                    assertUnreachable($$.type[0])
            }
            break
        }
        case astn.OverheadTokenType.NewLine: {
            out.push("\n")
            break
        }
        case astn.OverheadTokenType.WhiteSpace: {
            const $$ = $.type[1]
            out.push($$.value)
            break
        }
        default:
            assertUnreachable($.type[0])
    }
}

class OutPutter implements astn.TextParserEventConsumer<null, null> {
    readonly out: string[]
    constructor(out: string[]) {
        this.out = out
    }
    onData(data: astn.TreeEvent) {
        switch (data.type[0]) {
            case astn.TreeEventType.CloseArray: {
                const $ = data.type[1]
                this.out.push($.closeCharacter)
                break
            }
            case astn.TreeEventType.CloseObject: {
                const $ = data.type[1]
                this.out.push($.closeCharacter)
                break
            }
            case astn.TreeEventType.Colon: {
                this.out.push(":")
                break
            }
            case astn.TreeEventType.Comma: {
                this.out.push(",")
                break
            }
            case astn.TreeEventType.OpenArray: {
                const $ = data.type[1]
                this.out.push($.openCharacter)
                break
            }
            case astn.TreeEventType.OpenObject: {
                const $ = data.type[1]
                this.out.push($.openCharacter)
                break
            }
            case astn.TreeEventType.Overhead: {
                const $ = data.type[1]
                outputOverheadToken(this.out, $)
                break
            }
            case astn.TreeEventType.SimpleValue: {
                const $ = data.type[1]
                if ($.quote !== null) {

                    function serialize(str: string) {
                        const escaped = JSON.stringify(str)
                        return escaped.substring(1, escaped.length - 1) //remove quotes
                    }
                    this.out.push(`${$.quote}${serialize($.value)}${$.terminated ? $.quote : ""}`)
                } else {
                    this.out.push($.value)
                }
                break
            }
            case astn.TreeEventType.TaggedUnion: {
                this.out.push("|")
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return p.value(false)
    }
    //do the check
    onEnd(): p.IUnsafeValue<null, null> {
        return p.success(null)
    }
}

function createTestFunction(chunks: string[], test: TestDefinition, strictJSON: boolean) {
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

        function createTestRequiredValueHandler(): astn.RequiredValueHandler {
            return {
                onExists: createTestValueHandler(),
                onMissing: () => {
                    actualEvents.push(["stacked error", "missing value"])
                },
            }
        }
        function createTestValueHandler(): astn.OnValue {
            return _contextData => {
                return {
                    array: () => {
                        return {
                            onData: () => {
                                return createTestValueHandler()
                            },
                            onEnd: () => {
                                //
                                return p.value(null)
                            },
                        }
                    },
                    object: () => {
                        return {
                            onData: () => {
                                return p.value(createTestRequiredValueHandler())
                            },
                            onEnd: () => {
                                //
                                return p.value(null)
                            },
                        }

                    },
                    simpleValue: () => {
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
        }

        const stackedSubscriber = astn.createStackedParser(
            createTestRequiredValueHandler(),
            error => {

                actualEvents.push(["stacked error", printStackedDataError(error)])
            },
            () => {
                return p.success<null, null>(null)
            }
        )
        function onOverheadTokenEvent($: astn.OverheadToken, range: astn.Range) {

            switch ($.type[0]) {
                case astn.OverheadTokenType.Comment: {
                    const $$ = $.type[1]
                    if (DEBUG) console.log("found block comment")
                    if ($$.type === "block") {
                        actualEvents.push(["token", "blockcomment", $$.comment, getRange(test.testForLocation, range)])

                    } else {
                        actualEvents.push(["token", "linecomment", $$.comment, getRange(test.testForLocation, range)])

                    }
                    break
                }
                case astn.OverheadTokenType.NewLine: {
                    //const $ = data.type[1]
                    //place your code here
                    break
                }
                case astn.OverheadTokenType.WhiteSpace: {
                    //const $ = data.type[1]
                    //place your code here
                    break
                }
                default:
                    assertUnreachable($.type[0])
            }
        }
        const eventSubscriber: astn.TextParserEventConsumer<null, null> = {
            onData: data => {
                switch (data.type[0]) {
                    case astn.TreeEventType.CloseArray: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found close array")
                        actualEvents.push(["token", "closearray", $.closeCharacter, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case astn.TreeEventType.CloseObject: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found close object")
                        actualEvents.push(["token", "closeobject", $.closeCharacter, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case astn.TreeEventType.Colon: {
                        break
                    }
                    case astn.TreeEventType.Comma: {
                        break
                    }
                    case astn.TreeEventType.OpenArray: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found open array")
                        actualEvents.push(["token", "openarray", $.openCharacter, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case astn.TreeEventType.OpenObject: {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found open object")
                        actualEvents.push(["token", "openobject", $.openCharacter, getRange(test.testForLocation, data.range)])
                        break
                    }
                    case astn.TreeEventType.Overhead: {
                        const $ = data.type[1]
                        onOverheadTokenEvent($, data.range)
                        break
                    }
                    case astn.TreeEventType.SimpleValue: {
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
                    case astn.TreeEventType.TaggedUnion: {
                        //const $ = data.type[1]

                        if (DEBUG) console.log("found open tagged union")
                        actualEvents.push(["token", "opentaggedunion", getRange(test.testForLocation, data.range)])
                        break
                    }
                    default:
                        assertUnreachable(data.type[0])
                }
                return p.value(false)
            },
            onEnd: (_aborted, location): p.IUnsafeValue<null, null> => {
                if (DEBUG) console.log("found end")
                actualEvents.push(["end", getLocation(test.testForLocation, location)])
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
        const schemaDataSubscribers: astn.TextParserEventConsumer<null, null>[] = [
            new OutPutter(out),
            eventSubscriber,
            createFormatter(),
        ]
        const instanceDataSubscribers: astn.TextParserEventConsumer<null, null>[] = [
            new OutPutter(out),
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
        if (strictJSON) {
            headerSubscribers.push(new StrictJSONHeaderValidator((v, _range) => {
                actualEvents.push(["validationerror", v])
            }))
            instanceDataSubscribers.push(astn.createStrictJSONValidator((v, _range) => {
                if (DEBUG) console.log("found JSON validation error", v)
                actualEvents.push(["validationerror", v])
            }))
        }
        const parserStack = astn.createParserStack(
            range => {
                headerSubscribers.forEach(s => {
                    s.onSchemaDataStart(range)
                })
                return createStreamSplitter(schemaDataSubscribers)
            },
            location => {
                headerSubscribers.forEach(s => {
                    s.onInstanceDataStart(location)
                })
                return createStreamSplitter(instanceDataSubscribers)
            },
            (error, _location) => {
                if (DEBUG) console.log("found error")
                actualEvents.push(["parsingerror", printParsingError(error)])


            },
            (token, range) => {
                outputOverheadToken(out, token)
                onOverheadTokenEvent(token, range)
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
            const expectedFormattedText = test.formattedText ? test.formattedText : test.text

            if (!test.skipRoundTripCheck) {
                chai.assert.equal("roundtrip:\n" + out.join(""), "roundtrip:\n" + chunks.join("")
                    .replace(/\r\n/g, "\n")
                    .replace(/\n\r/g, "\n")
                    .replace(/\r/g, "\n")
                )
            }
            chai.assert.equal(
                "formatted:\n" + formattedText
                    .replace(/\r\n/g, "\n")
                    .replace(/\n\r/g, "\n")
                    .replace(/\r/g, "\n"),
                "formatted:\n" + expectedFormattedText
            )
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
