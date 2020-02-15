/* eslint
    no-console:"off",
*/

import * as p from "../src/Parser"
import { describe } from "mocha"
import * as assert from "assert"
import { JSONTests } from "./ownJSONTestset"
import { extensionTests } from "./JSONExtenstionsTestSet"
import { EventDefinition, AnyEvent } from "./testDefinition"
import { Location } from "../src/location"
import { Options } from "../src/configurationTypes"

const DEBUG = false

const selectedJSONTests = Object.keys(JSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

// const selectedJSONTests: string[] = ["forbidden_extension_apostrophe_string"]
// const selectedExtensionTests: string[] = []

function createTestFunction(chunks: string[], expectedEvents: EventDefinition[], opts?: Options) {
    return function () {
        if (DEBUG) {
            console.log("CHUNKS:", chunks)
        }
        const parser = p.parser(opts)
        let currentExpectedEventIndex = 0
        //const env = process && process.env ? process.env : window
        //const record: [AnyEvent, string][] = []
        function validateEventsEqual(expectedEvent: EventDefinition, event: AnyEvent) {
            assert.ok(expectedEvent[0] === event, 'event: ' + currentExpectedEventIndex + ', expected type: [' + expectedEvent[0] + '] got: [' + event + ']')
        }
        function checkLocation(expectedEvent: EventDefinition, location: Location) {
            if (expectedEvent[3] !== undefined) {
                assert.ok(expectedEvent[2] === location.line, `expected linenumber ${expectedEvent[2]} but found ${location.line}`)
                assert.ok(expectedEvent[3] === location.column, `expected column ${expectedEvent[3]} but found ${location.column}`)
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

        parser.onerror.subscribe(e => {
            if (DEBUG) console.log("found error")
            const ee = getExpectedEvent()
            if (ee[0] !== "error") {
                assert.fail("unexpected error: " + e.message)
            }
        })

        parser.onheaderdata.subscribe({
            onschemastart: location => {
                if (DEBUG) console.log("found schema start")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "schemastart")
                checkLocation(ee, location)

            },
            onschemaend: () => {
                if (DEBUG) console.log("found schema end")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "schemaend")
            },
            // onschema: (k, _startLocation, range) => {
            //     const ee = getExpectedEvent()
            //     validateEventsEqual(ee, "schema")
            //     assert.ok(ee[1] === k, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + k + ']');
            //     checkLocation(ee, range.end)
            // },
            oncompact: () => {
                //do nothing
            },
        })

        const subscriber: p.DataSubscriber = {
            onlinecomment: (v, range) => {
                if (DEBUG) console.log("found line comment")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "linecomment")

                assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
                checkLocation(ee, range.end)
            },
            onblockcomment: (v, range, _indent) => {
                if (DEBUG) console.log("found block comment")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "blockcomment")

                assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
                checkLocation(ee, range.end)
            },
            onunquotedstring: (v, range) => {
                if (DEBUG) console.log("found unquoted string")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "unquotedstring")

                assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
                checkLocation(ee, range.end)
            },
            onquotedstring: (v, _quote, range) => {
                if (DEBUG) console.log("found quoted string")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "quotedstring")

                assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
                checkLocation(ee, range.end)
            },

            onopentaggedunion: l => {
                if (DEBUG) console.log("found open tagged union")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "opentaggedunion")
                checkLocation(ee, l)
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
                checkLocation(ee, range.end)
            },

            onopenarray: l => {
                if (DEBUG) console.log("found open array")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "openarray")
                checkLocation(ee, l)
            },
            onclosearray: l => {
                if (DEBUG) console.log("found close array")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "closearray")
                checkLocation(ee, l)
            },

            onopenobject: l => {
                if (DEBUG) console.log("found open object")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "openobject")
                checkLocation(ee, l)
            },
            oncloseobject: l => {
                if (DEBUG) console.log("found close object")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "closeobject")
                checkLocation(ee, l)
            },
            onkey: (k, range) => {
                if (DEBUG) console.log("found key")
                const ee = getExpectedEvent()
                validateEventsEqual(ee, "key")
                assert.ok(ee[1] === k, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + k + ']');
                checkLocation(ee, range.end)
            },
            onend: () => {
                if (DEBUG) console.log("found end")

                const ee = getExpectedEvent()
                validateEventsEqual(ee, "end")
            },
        }
        parser.onschemadata.subscribe(subscriber)
        parser.ondata.subscribe(subscriber)

        parser.onready.subscribe(() => {
            if (DEBUG) console.log("found ready")

            const ee = getExpectedEvent()
            validateEventsEqual(ee, "ready")
        })

        chunks.forEach(chunk => {
            try {
                //if in error state, don't write or we'll get an exception
                if (!parser.isInErrorState()) {
                    parser.write(chunk);
                }
            } catch (e) {

                assert.fail("could not write: " + e.message)
            }
        });
        parser.end()
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
            it('[' + key + '] should be able to parse -> one chunk', createTestFunction([test.text], test.events.slice(0), test.options));
            it('[' + key + '] should be able to parse -> every character is a chunck', createTestFunction(test.text.split(''), test.events.slice(0), test.options));
        })
    })
    describe('#extensions', () => {
        selectedExtensionTests.forEach(key => {
            const test = extensionTests[key]
            it('[' + key + '] should be able to parse -> one chunk', createTestFunction([test.text], test.events.slice(0), test.options));
            it('[' + key + '] should be able to parse -> every character is a chunck', createTestFunction(test.text.split(''), test.events.slice(0), test.options));
        })
    });

    describe('#pre-chunked', () => {
        selectedJSONTests.forEach(key => {
            const test = JSONTests[key]
            if (!test.chunks) return;
            it('[' + key + '] should be able to parse pre-chunked', createTestFunction(test.chunks, test.events.slice(0), test.options));
        })
    });
});
