/* eslint
    no-console:"off",
*/

import * as bc from "../src"
import { describe } from "mocha"
import * as chai from "chai"
import * as assert from "assert"
import { JSONTests } from "./ownJSONTestset"
import { extensionTests } from "./JSONExtenstionsTestSet"
import { EventDefinition, AnyEvent, TestRange, TestLocation, TestDefinition } from "./testDefinition"
import { createStackedDataSubscriber, ExpectContext, printRange, ValueHandler } from "../src"

const DEBUG = false

const selectedJSONTests = Object.keys(JSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

// const selectedJSONTests: string[] = ["forbidden_extension_apostrophe_string"]
// const selectedExtensionTests: string[] = []

function createTestFunction(chunks: string[], test: TestDefinition, pureJSON: boolean) {
    const expectedEvents = test.events.slice()
    const parserOptions = test.parserOptions
    return function () {
        if (DEBUG) console.log("CHUNKS:", chunks)
        const parser = new bc.Parser(
            (message, range) => {
                if (DEBUG) console.log("found error")
                const ee = getExpectedEvent()
                if (ee[0] !== "parsererror") {
                    assert.fail(`unexpected parser error: ${message} @ ${printRange(range)}`)
                }
                assert.ok(ee[1] === message, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + message + ']');

            },
            parserOptions
        )
        const tokenizer = new bc.Tokenizer(
            parser,
            (message, _location) => {
                if (DEBUG) console.log("found error")
                const ee = getExpectedEvent()
                if (ee[0] !== "tokenizererror") {
                    assert.fail("unexpected tokenizer error: " + message)
                }
                assert.ok(ee[1] === message, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + message + ']');
            }
        )
        let currentExpectedEventIndex = 0
        //const env = process && process.env ? process.env : window
        //const record: [AnyEvent, string][] = []
        function validateEventsEqual(expectedEvent: EventDefinition, event: AnyEvent) {
            assert.ok(expectedEvent[0] === event, 'event: ' + currentExpectedEventIndex + ', expected type: [' + expectedEvent[0] + '] got: [' + event + ']')
        }
        function eventsNotEqual(expectedEvent: EventDefinition, event: AnyEvent) {
            assert.fail('event: ' + currentExpectedEventIndex + ', expected type: [' + expectedEvent[0] + '] got: [' + event + ']')
        }
        function checkRange(range: bc.Range, expectedEventRange?: TestRange) {
            if (expectedEventRange !== undefined) {
                assert.ok(expectedEventRange[0] === range.start.line, `expected start linenumber ${expectedEventRange[0]} but found ${range.start.line}`)
                assert.ok(expectedEventRange[1] === range.start.column, `expected start column ${expectedEventRange[1]} but found ${range.start.column}`)
                assert.ok(expectedEventRange[2] === range.end.line, `expected end linenumber ${expectedEventRange[2]} but found ${range.end.line}`)
                assert.ok(expectedEventRange[3] === range.end.column, `expected end column ${expectedEventRange[3]} but found ${range.end.column}`)
            }
        }
        function checkLocation(location: bc.Location, expectedEventLocation?: TestLocation) {
            if (expectedEventLocation !== undefined) {
                assert.ok(expectedEventLocation[0] === location.line, `expected linenumber ${expectedEventLocation[0]} but found ${location.line}`)
                assert.ok(expectedEventLocation[1] === location.column, `expected column ${expectedEventLocation[1]} but found ${location.column}`)
            }
        }
        function getExpectedEvent() {
            // const temp_env: any = env
            // if (temp_env.CRECORD) { // for really big json we dont want to type all
            //     record.push([event, value]);
            //     if (event === "end") console.log(JSON.stringify(record, null, 2));
            // } else {
            const currentExpectedEvent = expectedEvents.shift();
            ++currentExpectedEventIndex;
            if (currentExpectedEvent === undefined) {
                assert.fail(`more events than expected, expected ${currentExpectedEventIndex - 1}`)
            }
            return currentExpectedEvent


            // if (currentExpectedEvent[3] !== undefined) {
            //     //check line numbers

            // }
            //}
        }

        if (test.testHeaders) {
            parser.onheaderdata.subscribe({
                onheaderstart: () => {
                    if (DEBUG) console.log("found header start")
                    const ee = getExpectedEvent()
                    if (ee[0] !== "headerstart") {
                        eventsNotEqual(ee, "headerstart")
                    }
                    //checkRange(range, ee[2])

                },
                onschemastart: range => {
                    if (DEBUG) console.log("found schema start")
                    const ee = getExpectedEvent()
                    if (ee[0] !== "schemastart") {
                        eventsNotEqual(ee, "schemastart")
                    }
                    checkRange(range, ee[2])

                },
                onheaderend: () => {
                    if (DEBUG) console.log("found header end")
                    const ee = getExpectedEvent()
                    validateEventsEqual(ee, "headerend")
                },
                // onschema: (k, _startLocation, range) => {
                //     const ee = getExpectedEvent()
                //     validateEventsEqual(ee, "schema")
                //     assert.ok(ee[1] === k, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + k + ']');
                //     checkLocation(ee, range.end)
                // },
                oncompact: () => {
                    if (DEBUG) console.log("found compact")
                    const ee = getExpectedEvent()
                    validateEventsEqual(ee, "compact")
                },
            })
        }

        const subscriber: bc.DataSubscriber = {
            oncomma: () => {
                //
            },
            oncolon: () => {
                //
            },
            onlinecomment: (v, range) => {
                if (DEBUG) console.log("found line comment")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "linecomment")

                assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
                checkRange(range, ee[2])

            },
            onblockcomment: (v, range, _indent) => {
                if (DEBUG) console.log("found block comment")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "blockcomment")

                assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
                checkRange(range, ee[2])
            },
            onunquotedtoken: (v, range) => {
                if (DEBUG) console.log("found unquoted token")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "unquotedtoken")

                assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
                checkRange(range, ee[2])
            },
            onquotedstring: (v, _quote, range) => {
                if (DEBUG) console.log("found quoted string")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "quotedstring")

                assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
                checkRange(range, ee[2])
            },

            onopentaggedunion: range => {
                if (DEBUG) console.log("found open tagged union")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "opentaggedunion")
                checkRange(range, ee[2])
            },
            onclosetaggedunion: () => {
                if (DEBUG) console.log("found close tagged union")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "closetaggedunion")
            },
            onoption: (k, range) => {
                if (DEBUG) console.log("found option")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "option")
                assert.ok(ee[1] === k, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + k + ']');
                checkRange(range, ee[2])
            },

            onopenarray: range => {
                if (DEBUG) console.log("found open array")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "openarray")
                checkRange(range, ee[2])
            },
            onclosearray: range => {
                if (DEBUG) console.log("found close array")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "closearray")
                checkRange(range, ee[2])
            },

            onopenobject: range => {
                if (DEBUG) console.log("found open object")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "openobject")
                checkRange(range, ee[2])
            },
            oncloseobject: range => {
                if (DEBUG) console.log("found close object")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "closeobject")
                checkRange(range, ee[2])
            },
            onkey: (k, range) => {
                if (DEBUG) console.log("found key")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "key")
                assert.ok(ee[1] === k, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + k + ']');
                checkRange(range, ee[2])
            },
            onend: location => {
                if (DEBUG) console.log("found end")

                const ee = getExpectedEvent()

                if (ee[0] !== "end") {
                    eventsNotEqual(ee, "end")
                } else {
                    checkLocation(location, ee[1])
                }

            },
        }
        parser.onschemadata.subscribe(subscriber)

        if (pureJSON) {
            parser.ondata.subscribe(bc.createStrictJSONValidator((message, range) => {
                if (DEBUG) console.log("found JSON validation error", message)

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "validationerror")
                assert.ok(ee[1] === message, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + message + ']');
                checkRange(range, ee[2])
            }))
        }
        parser.ondata.subscribe(subscriber)

        chunks.forEach(chunk => {
            try {
                //if in error state, don't write or we'll get an exception
                tokenizer.write(chunk);
            } catch (e) {
                assert.fail("could not write: " + e.message)
            }
        });
        tokenizer.end()
        if (expectedEvents.length !== 0) {
            console.log("expected more events.")
            while (true) {
                const ee = expectedEvents.pop()
                if (ee === undefined) {
                    break
                }
                console.log(ee)
            }
            throw new Error("expected more events.")
        }
    };
}

describe('bass-clarinet', () => {
    describe('#pureJSON', () => {
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
    describe('#expect', () => {
        function doTest(data: string, callback: (expect: ExpectContext) => ValueHandler, expectedErrors: string[]) {
            const foundErrors: string[] = []
            const onError = (message: string, _range: bc.Range) => {
                foundErrors.push(message)
            }
            const onWarning = (message: string, _range: bc.Range) => {
                foundErrors.push(message)
            }
            const parser = new bc.Parser(
                onError,
                {}
            )
            const tok = new bc.Tokenizer(
                parser,
                (message, _location) => {
                    foundErrors.push(message)
                },
                {}
            )
            const expect = new ExpectContext(onError, onWarning)
            parser.ondata.subscribe(createStackedDataSubscriber(
                callback(expect),
                err => {
                    foundErrors.push(err.message)
                },
                () => {
                    //do nothing with end
                },
            ))
            tok.write(data)
            tok.end()
            chai.assert.deepEqual(foundErrors, expectedErrors)
        }

        it('duplicate key', () => {
            doTest(
                `{ "a": (), "a": () }`,
                expect => expect.expectDictionary(
                    (_key, _range) => {
                        return expect.expectType(
                            () => {
                                //
                            },
                            {},
                            () => {
                                //
                            }
                        )
                    }
                ),
                ["duplicate key 'a'"]
            )
        })
        it('duplicate property', () => {
            doTest(
                `( "a": 42, "a": 42 )`,
                expect => expect.expectType(
                    () => {
                        //
                    },
                    {
                        a: () => expect.expectNumber(() => {
                            //
                        }),
                    },
                    () => {
                        //
                    },
                ),
                ["property already processed: 'a'"]
            )
        })
    });
});
