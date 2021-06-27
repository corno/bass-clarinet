/* eslint
    no-console:"off",
    complexity: "off",
    max-classes-per-file: "off",
*/
import * as p from "pareto"
import * as p20 from "pareto-20"
import * as astn from "../src"
import * as core from "astn-core"

import { describe } from "mocha"
import * as chai from "chai"
import { ownJSONTests } from "./data/ownJSONTestset"
import { extensionTests } from "./data/ASTNTestSet"
import { EventDefinition, TestRange, TestLocation, TestDefinition } from "./TestDefinition"
import { getEndLocationFromRange, TokenizerAnnotationData, createErrorStreamHandler } from "../src"
import { createSerializedQuotedString, RequiredValueHandler, SimpleStringData, ValueHandler } from "astn-core"

function createStreamSplitter<DataType, EndDataType>(
    subStreamConsumers: p.IUnsafeStreamConsumer<DataType, EndDataType, null, null>[]
): p.IUnsafeStreamConsumer<DataType, EndDataType, null, null> {
    return {
        onData: (data: DataType): p.IValue<boolean> => {
            const promises: p.IValue<boolean>[] = []
            subStreamConsumers.forEach(s => {
                const returnValue = s.onData(data)
                promises.push(returnValue)
            })
            if (promises.length === 0) {
                return p.value(false)
            }
            return p20.createArray(promises).mergeSafeValues(x => x).mapResult(abortResquests => {
                return p.value(abortResquests.includes(true)) //if 1 promise requested an abort
            })
        },
        onEnd: (aborted: boolean, endData: EndDataType): p.IUnsafeValue<null, null> => {
            return p20.createArray(
                subStreamConsumers
            ).mergeUnsafeValues(v => v.onEnd(aborted, endData)
            ).mapError(() => {
                return p.value(null)
            }).mapResult(() => {
                return p.value(null)
            })
        },
    }
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const DEBUG = false

const selectedOwnJSONTests = Object.keys(ownJSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

// const selectedJSONTests: string[] = []
// const selectedExtensionTests: string[] = ["comment"]

// type OnError = (message: string, range: astn.Range) => void

type ParserRequiredValueHandler = RequiredValueHandler<TokenizerAnnotationData, null, p.IValue<null>>
type ParserValueHandler = ValueHandler<TokenizerAnnotationData, null, p.IValue<null>>

interface HeaderSubscriber {
    onEmbeddedSchema(schemaSchemaName: string): void
    onSchemaReference(schemaReference: SimpleStringData, annotation: TokenizerAnnotationData): void
    onInstanceDataStart(annotation: astn.TokenizerAnnotationData): void
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


        function createTestRequiredValueHandler(): ParserRequiredValueHandler {
            return {
                exists: createTestValueHandler(),
                missing: () => {
                    actualEvents.push(["stacked error", "missing value"])
                },
            }
        }
        function createTestValueHandler(): ParserValueHandler {
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
                            return createTestRequiredValueHandler()
                        },
                        objectEnd: () => {
                            //
                            return p.value(null)
                        },
                    }

                },
                simpleString: () => {
                    return p.value(null)
                },
                multilineString: () => {
                    return p.value(null)
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
                            return p.value(null)
                        },
                    }
                },
            }
        }
        const stackedSubscriber = core.createStackedParser(
            {
                root: createTestRequiredValueHandler(),
            },
            error => {
                actualEvents.push(["stacked error", core.printStackedDataError(error.type)])
            },
            () => {
                return p.success<null, null>(null)
            },
            () => core.createDummyValueHandler(() => p.value(null))
        )
        const eventSubscriber: core.ITreeBuilder<TokenizerAnnotationData, null, null> = {
            onData: data => {
                switch (data.type[0]) {
                    case "close array": {
                        if (DEBUG) console.log("found close array")
                        actualEvents.push(["token", "closearray", data.annotation.tokenString, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case "close object": {
                        if (DEBUG) console.log("found close object")
                        actualEvents.push(["token", "closeobject", data.annotation.tokenString, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case "open array": {
                        if (DEBUG) console.log("found open array")
                        actualEvents.push(["token", "openarray", data.annotation.tokenString, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case "open object": {
                        if (DEBUG) console.log("found open object")
                        actualEvents.push(["token", "openobject", data.annotation.tokenString, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case "multiline string": {
                        const $ = data.type[1]
                        if (DEBUG) console.log("found wrapped string")
                        actualEvents.push(["token", "multiline string", $.lines.join("\\n"), getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case "simple string": {
                        const $ = data.type[1]
                        actualEvents.push(["token", "simple string", $.value, getRange(test.testForLocation, data.annotation.range)])
                        break
                    }
                    case "tagged union": {
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
        const out: string[] = []
        const schemaDataSubscribers: core.ITreeBuilder<TokenizerAnnotationData, null, null>[] = [
            eventSubscriber,
        ]
        const instanceDataSubscribers: core.ITreeBuilder<TokenizerAnnotationData, null, null>[] = [
            eventSubscriber,
            stackedSubscriber,
        ]
        const headerSubscribers: HeaderSubscriber[] = [
            {
                onEmbeddedSchema: () => {
                    out.push("!")
                    return []
                },
                onSchemaReference: schemaReference => {
                    out.push(`! ${createSerializedQuotedString(schemaReference.value)}`)
                },
                onInstanceDataStart: () => {
                    return []
                },
            },
        ]

        if (test.testHeaders) {
            headerSubscribers.push({
                onEmbeddedSchema: _range => {
                    actualEvents.push(["token", "schema data start"])
                },
                onSchemaReference: (schemaReference, annotation) => {
                    actualEvents.push(["token", "schema data start"])
                    actualEvents.push(["token", "simple string", schemaReference.value, getRange(test.testForLocation, annotation.range)])
                },
                onInstanceDataStart: () => {
                    actualEvents.push(["instance data start"])
                },
            })
        }
        const parserStack = astn.createParserStack(
            schemaSchemaName => {
                headerSubscribers.forEach(s => {
                    s.onEmbeddedSchema(schemaSchemaName)
                })
                return createStreamSplitter(schemaDataSubscribers)
            },
            (schemaName, annotation) => {
                headerSubscribers.forEach(s => {
                    s.onSchemaReference(schemaName, annotation)
                })
                return p.value(null)
            },
            annotation => {
                headerSubscribers.forEach(s => {
                    s.onInstanceDataStart(annotation)
                })
                return createStreamSplitter(instanceDataSubscribers)
            },
            createErrorStreamHandler(false, str => actualEvents.push(["parsingerror", str]))
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
