import * as p from "../src/Parser"
import { describe } from "mocha"
import * as assert from "assert"
import { EventDefinition, tests } from "./ownTestset"

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

function createTestFunction(doc_chunks: string[], expectedEvents: EventDefinition[]) {
    return function () {
        const parser = p.parser()
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
                assert.fail("more events than expected")
            }
            return currentExpectedEvent


            // if (currentExpectedEvent[3] !== undefined) {
            //     //check line numbers

            // }
            //}
        }

        parser.onerror.subscribe((e) => {
            const ee = getExpectedEvent()
            if (ee[0] !== "error") {
                assert.fail("unexpected error: " + e.message)
            }
        })
        parser.onkey.subscribe((k, range) => {
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "key")
            assert.ok(ee[1] === k, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + k + ']');
            checkLocation(ee, range.end)
        })
        parser.onvalue.subscribe((v, range) => {
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "value")

            assert.ok(ee[1] === v, 'event:' + currentExpectedEventIndex + ' expected value: [' + ee[1] + '] got: [' + v + ']');
            checkLocation(ee, range.end)
        })
        parser.onopenarray.subscribe(l => {
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "openarray")
            checkLocation(ee, l)
        })
        parser.onclosearray.subscribe(l => {
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "closearray")
            checkLocation(ee, l)
        })
        parser.onopenobject.subscribe(l => {
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "openobject")
            checkLocation(ee, l)
        })
        parser.oncloseobject.subscribe(l => {
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "closeobject")
            checkLocation(ee, l)
        })
        parser.onend.subscribe(() => {
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "end")

        })
        parser.onready.subscribe(() => {
            const ee = getExpectedEvent()
            validateEventsEqual(ee, "ready")
        })

        doc_chunks.forEach(function (chunk) {
            try {
                if (parser.state[0] === p.GlobalStateType.ERROR) {
                    assert.fail("error state: " + parser.state[1].error.message)
                } else {
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
        for (var key in tests) {
            if (tests.hasOwnProperty(key)) {

                const seps = [undefined, /\t|\n|\r/, '']
                // undefined means no split
                // /\t|\n|\r| / means on whitespace
                // '' means on every char
                for (var i in seps) {
                    const sep = seps[i];
                    const doc = tests[key]
                    it('[' + key + '] should be able to parse -> ' + sep, createTestFunction(sep === undefined ? [doc.text] : doc.text.split(sep), doc.events.slice(0)));
                }
            }
        }
    });

    describe('#pre-chunked', function () {
        for (var key in tests) {
            if (tests.hasOwnProperty(key)) {
                const doc = tests[key]

                if (!doc.chunks) continue;

                it('[' + key + '] should be able to parse pre-chunked', createTestFunction(doc.chunks, doc.events.slice(0)));
            }
        }
    });
});
