/* eslint
    no-console:"off",
    complexity: "off",
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as p20 from "pareto-20"
import * as bc from "../src"
import { describe } from "mocha"
import * as chai from "chai"
import { JSONTests } from "./ownJSONTestset"
import { extensionTests } from "./JSONExtenstionsTestSet"
import { EventDefinition, TestRange, TestLocation, TestDefinition } from "./testDefinition"
import { createStackedDataSubscriber, ValueHandler, RequiredValueHandler, ParserEventType, ParserEventConsumer, createStrictJSONValidator, ParserEvent } from "../src"
import { createStreamSplitter } from "../src/createStreamSplitter"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const DEBUG = false

const selectedJSONTests = Object.keys(JSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

// const selectedJSONTests: string[] = []
// const selectedExtensionTests: string[] = ["schema 2"]

type OnError = (message: string, range: bc.Range) => void

interface HeaderSubscriber {
    onSchemaDataStart(range: bc.Range): void
    onInstanceDataStart(compact: null | bc.Range, location: bc.Location): void
}

class StrictJSONHeaderValidator implements HeaderSubscriber {
    private readonly onError: OnError

    constructor(onError: OnError) {
        this.onError = onError
    }
    onSchemaDataStart(range: bc.Range) {
        this.onError(`headers are not allowed in strict JSON`, range)
    }
    onInstanceDataStart() {
        return createStrictJSONValidator(this.onError)
    }
}


class OutPutter implements ParserEventConsumer<null, null> {
    readonly out: string[]
    constructor(out: string[]) {
        this.out = out
    }
    onData(data: ParserEvent) {
        switch (data.type[0]) {
            case ParserEventType.BlockComment: {
                const $ = data.type[1]
                this.out.push(`/*${$.comment}*/`)
                break
            }
            case ParserEventType.CloseArray: {
                const $ = data.type[1]
                this.out.push($.closeCharacter)
                break
            }
            case ParserEventType.CloseObject: {
                const $ = data.type[1]
                this.out.push($.closeCharacter)
                break
            }
            case ParserEventType.Colon: {
                this.out.push(":")
                break
            }
            case ParserEventType.Comma: {
                this.out.push(",")
                break
            }
            case ParserEventType.LineComment: {
                const $ = data.type[1]
                this.out.push(`//${$.comment}`)
                break
            }
            case ParserEventType.NewLine: {
                this.out.push("\n")
                break
            }
            case ParserEventType.OpenArray: {
                const $ = data.type[1]
                this.out.push($.openCharacter)
                break
            }
            case ParserEventType.OpenObject: {
                const $ = data.type[1]
                this.out.push($.openCharacter)
                break
            }
            case ParserEventType.SimpleValue: {
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
            case ParserEventType.TaggedUnion: {
                this.out.push("|")
                break
            }
            case ParserEventType.WhiteSpace: {
                const $ = data.type[1]
                this.out.push($.value)
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return p.result(false)
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
                simpleValue: (_range, _data, contextData) => {
                    if (contextData.lineCommentAfter !== null) {
                        console.log("YEP")
                    }
                    return p.result(false)
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
                return p.success<null, null>(null)
            }
        )
        const eventSubscriber: ParserEventConsumer<null, null> = {
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
            onEnd: (_aborted, location): p.IUnsafeValue<null, null> => {
                if (DEBUG) console.log("found end")
                actualEvents.push(["end", getLocation(test.testForLocation, location)])
                return p.success(null)
            },
        }

        let formattedText = test.text
        let offset = 0

        function createFormatter(trimTrailingWhitespace: boolean) {
            return bc.createFormatter(
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

                    return p.result(null)

                },
                trimTrailingWhitespace,
            )
        }
        const out: string[] = []
        const schemaDataSubscribers: ParserEventConsumer<null, null>[] = [
            new OutPutter(out),
            eventSubscriber,
            createFormatter(false),
        ]
        const instanceDataSubscribers: ParserEventConsumer<null, null>[] = [
            new OutPutter(out),
            eventSubscriber,
            stackedSubscriber,
            createFormatter(true),
        ]
        const headerSubscribers: HeaderSubscriber[] = [
            {
                onSchemaDataStart: () => {
                    out.push("!")
                    return []
                },
                onInstanceDataStart: compact => {
                    if (compact) {
                        out.push("# ")
                    }
                    return []
                },
            },
        ]

        if (test.testHeaders) {
            headerSubscribers.push({
                onSchemaDataStart: _range => {
                    actualEvents.push(["token", "schema data start"])
                },
                onInstanceDataStart: compact => {
                    if (compact !== null) {
                        actualEvents.push(["token", "compact"])
                    }
                    actualEvents.push(["instance data start", compact !== null])
                },
            })
        }
        if (strictJSON) {
            headerSubscribers.push(new StrictJSONHeaderValidator((v, _range) => {
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
                onSchemaDataStart: range => {
                    headerSubscribers.forEach(s => {
                        s.onSchemaDataStart(range)
                    })
                    return createStreamSplitter(schemaDataSubscribers)
                },
                onInstanceDataStart: (compact, location) => {
                    headerSubscribers.forEach(s => {
                        s.onInstanceDataStart(compact, location)
                    })
                    return createStreamSplitter(instanceDataSubscribers)
                },
            },
        )

        const st = bc.createStreamTokenizer(
            parser,
            (message, _location) => {
                if (DEBUG) console.log("found error")

                actualEvents.push(["tokenizererror", message])
            },
        )
        return p20.createArray(chunks).streamify().toUnsafeValue(
            null,
            st
        ).convertToNativePromise(() => "Error found").then(() => {
            //

            if (test.events !== undefined) {
                chai.assert.deepEqual(actualEvents, test.events)
            }
            const expectedFormattedText = test.formattedText ? test.formattedText : test.text

            if (!test.skipRoundTripCheck) {
                chai.assert.equal(out.join(""), chunks.join("")
                    .replace(/\r\n/g, "\n")
                    .replace(/\n\r/g, "\n")
                    .replace(/\r/g, "\n")
                )
            }
            chai.assert.equal(
                formattedText
                    .replace(/\r\n/g, "\n")
                    .replace(/\n\r/g, "\n")
                    .replace(/\r/g, "\n"),
                expectedFormattedText
            )
        })
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
