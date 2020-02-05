import * as p from "../src/CParser"
import { describe } from "mocha"
import * as assert from "assert"
import { EventDefinition, tests } from "./testset"

function assertUnreachable(_x: never) {
    throw new Error("unreachable")
}



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


export const EVENTS: AnyEvent[] =
    [
        "value"
        , "key"
        , "openobject"
        , "closeobject"
        , "openarray"
        , "closearray"
        , "error"
        , "end"
        , "ready"
    ]

function doTest(doc_chunks: string[], expectedEvents: EventDefinition[]) {
    return function () {
        const parser = p.parser()
        let currentExpectedEventIndex = 0
        const env = process && process.env ? process.env : window
        const record: [AnyEvent, string][] = []

        EVENTS.forEach(function (event) {
            function x(value: any) {
                const temp_env: any = env
                if (temp_env.CRECORD) { // for really big json we dont want to type all
                    record.push([event, value]);
                    if (event === "end") console.log(JSON.stringify(record, null, 2));
                } else {
                    const currentExpectedEvent = expectedEvents.shift();
                    ++currentExpectedEventIndex;
                    if (!(currentExpectedEvent && currentExpectedEvent[0])) {
                        assert.fail("more events than expected")
                    }
                    if (event === "error" && currentExpectedEvent[0] !== "error") {
                        assert.fail("unexpected error: " + value.message)
                    }
                    assert.ok(currentExpectedEvent[0] === event, 'event: ' + currentExpectedEventIndex + ', expected type: [' + currentExpectedEvent[0] + '] got: [' + event + ']');
                    if (event !== 'error') {
                        assert.ok(currentExpectedEvent[1] === value, 'event:' + currentExpectedEventIndex + ' expected value: [' + currentExpectedEvent[1] + '] got: [' + value + ']');
                    } else {
                        //assert1(currentExpectedEvent[1] === value.message, '[' + currentExpectedEventIndex + '] value: [' + currentExpectedEvent[1] + '] got: [' + value + ']');
                    }
                    if (currentExpectedEvent[3] !== undefined) {
                        //check line numbers
                        assert.ok(currentExpectedEvent[2] === parser.line, `expected linenumber ${currentExpectedEvent[2]} but found ${parser.line}`)
                        assert.ok(currentExpectedEvent[3] === parser.column, `expected column ${currentExpectedEvent[3]} but found ${parser.column}`)
                    }
                }
            };
            switch (event) {
                case "end": parser.onend.subscribe(x); break
                case "error": parser.onerror.subscribe(x); break
                case "key": parser.onkey.subscribe(x); break
                case "value": parser.onvalue.subscribe(x); break
                case "ready": parser.onready.subscribe(x); break
                case "openarray": parser.onopenarray.subscribe(x); break
                case "closearray": parser.onclosearray.subscribe(x); break
                case "openobject": parser.onopenobject.subscribe(x); break
                case "closeobject": parser.oncloseobject.subscribe(x); break
                default:
                    assertUnreachable(event)
            }
        });
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
                    it('[' + key + '] should be able to parse -> ' + sep, doTest(sep === undefined ? [doc.text] : doc.text.split(sep), doc.events.slice(0)));
                }
            }
        }
    });

    describe('#pre-chunked', function () {
        for (var key in tests) {
            if (tests.hasOwnProperty(key)) {
                const doc = tests[key]

                if (!doc.chunks) continue;

                it('[' + key + '] should be able to parse pre-chunked', doTest(doc.chunks, doc.events.slice(0)));
            }
        }
    });
});
