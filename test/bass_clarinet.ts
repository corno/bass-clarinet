import * as p from "../src/Parser"
import { describe } from "mocha"
import * as assert from "assert"
import { EventDefinition, tests } from "./ownTestset"

const DEBUG = false


const selectedTests = Object.keys(tests)
//const selectedTests = ['single_line_comment_allowed', "single_line_comment_forbidden"]

// function assertUnreachable(_x: never) {
//     throw new Error("unreachable")
// }

type Event =
    | "value"
    | "key"
    | "openobject"
    | "closeobject"
    | "openarray"
    | "closearray"
    | "ready"


type AnyEvent =
    | "end"
    | "error"
    | Event

function createTestFunction(chunks: string[], expectedEvents: EventDefinition[], opts?: p.Options) {
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
        function checkLocation(expectedEvent: EventDefinition, location: p.Location) {
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

        parser.onerror.subscribe((e) => {
            if (DEBUG) console.log("found error")
            const ee = getExpectedEvent()
            if (ee[0] !== "error") {
                assert.fail("unexpected error: " + e.message)
            }
        })
        parser.onkey.subscribe((k, range) => {
            if (DEBUG) console.log("found key")
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "key")
            assert.ok(ee[1] === k, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + k + ']');
            checkLocation(ee, range.end)
        })
        parser.onvalue.subscribe((v, range) => {
            if (DEBUG) console.log("found value")
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "value")

            assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
            checkLocation(ee, range.end)
        })
        parser.onopenarray.subscribe(l => {
            if (DEBUG) console.log("found open array")
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "openarray")
            checkLocation(ee, l)
        })
        parser.onclosearray.subscribe(l => {
            if (DEBUG) console.log("found close array")

            const ee = getExpectedEvent()
            validateEventsEqual(ee, "closearray")
            checkLocation(ee, l)
        })
        parser.onopenobject.subscribe(l => {
            if (DEBUG) console.log("found open object")

            const ee = getExpectedEvent()
            validateEventsEqual(ee, "openobject")
            checkLocation(ee, l)
        })
        parser.oncloseobject.subscribe(l => {
            if (DEBUG) console.log("found close object")

            const ee = getExpectedEvent()
            validateEventsEqual(ee, "closeobject")
            checkLocation(ee, l)
        })
        parser.onend.subscribe(() => {
            if (DEBUG) console.log("found end")

            const ee = getExpectedEvent()
            validateEventsEqual(ee, "end")

        })
        parser.onready.subscribe(() => {
            if (DEBUG) console.log("found ready")

            const ee = getExpectedEvent()
            validateEventsEqual(ee, "ready")
        })

        chunks.forEach(function (chunk) {
            try {
                if (parser.state[0] !== p.GlobalStateType.ERROR) {
                    //if in error state, don't write or we'll get an exception
                    parser.write(chunk);
                }
            } catch (e) {

                assert.fail("could not write: " + e.message)
            }
        });
        parser.end()
        if (expectedEvents.length !== 0) {
            console.log("expected events left")
            while (true) {
                const ee = expectedEvents.pop()
                if (ee === undefined) {
                    break
                }
                console.log(ee)
            }
        }
    };
}

describe('bass-clarinet', function () {
    describe('#generic', function () {
        selectedTests.forEach(key => {
            const test = tests[key]
            it('[' + key + '] should be able to parse -> one chunk', createTestFunction([test.text], test.events.slice(0), test.options));
            it('[' + key + '] should be able to parse -> every character is a chunck', createTestFunction(test.text.split(''), test.events.slice(0), test.options));
        })
    });

    describe('#pre-chunked', function () {
        selectedTests.forEach(key => {
            const test = tests[key]

            if (!test.chunks) return;


            it('[' + key + '] should be able to parse pre-chunked', createTestFunction(test.chunks, test.events.slice(0), test.options));

        })
    });
});
