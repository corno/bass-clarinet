/* eslint
    no-console:"off",
*/

import * as bc from "../src"
import { describe } from "mocha"
import * as chai from "chai"
import * as assert from "assert"
import { JSONTests } from "./ownJSONTestset"
import { extensionTests } from "./JSONExtenstionsTestSet"
import { EventDefinition, TestRange, TestLocation, TestDefinition } from "./testDefinition"
import { SimpleValueRole } from "../src"

const DEBUG = false

const selectedJSONTests = Object.keys(JSONTests)
const selectedExtensionTests = Object.keys(extensionTests)

function assertUnreachable(_x: never) {
    throw new Error("unreachable")
}

//const selectedJSONTests: string[] = ["two keys"]
//const selectedExtensionTests: string[] = []

function createTestFunction(chunks: string[], test: TestDefinition, strictJSON: boolean) {
    const expectedEvents = test.events
    return function () {
        if (DEBUG) console.log("CHUNKS:", chunks)
        const parser = new bc.Parser(
            (message, _range) => {
                if (DEBUG) console.log("found error")
                actualEvents.push(["parsererror", message])
            }
        )

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

        if (test.testHeaders) {
            parser.onheaderdata.subscribe({
                onHeaderStart: _range => {
                    if (DEBUG) console.log("found header start")
                    actualEvents.push(["headerstart"])
                },
                onHeaderEnd: () => {
                    if (DEBUG) console.log("found header end")
                    actualEvents.push(["headerend"])
                },
                onCompact: () => {
                    if (DEBUG) console.log("found compact")
                    actualEvents.push(["compact"])
                },
            })
        }

        /*
        RECREATE THE ORIGINAL STRING
        */
        const out: string[] = []

        function serialize(str: string) {
            const escaped = JSON.stringify(str)
            return escaped.substring(1, escaped.length - 1) //remove quotes
        }
        const outputter: bc.DataSubscriber = {
            onComma: () => {
                out.push(",")
            },
            onColon: () => {
                out.push(":")
            },
            onLineComment: (comment, _range) => {
                out.push("//" + comment)
            },
            onBlockComment: (comment, _range) => {
                out.push("/*" + comment + "*/")
            },
            onQuotedString: (value, role, quote, _range, terminated) => {
                switch (role) {
                    case SimpleValueRole.KEY: {
                        out.push(quote + serialize(value) + (terminated ? quote : ""))
                        break
                    }
                    case SimpleValueRole.OPTION: {
                        out.push(quote + serialize(value) + (terminated ? quote : ""))
                        break
                    }
                    case SimpleValueRole.VALUE: {
                        out.push(quote + serialize(value) + (terminated ? quote : ""))
                        break
                    }
                    default:
                        return assertUnreachable(role)
                }
            },
            onUnquotedToken: (value, _range) => {
                out.push(value)
            },
            onOpenTaggedUnion: _range => {
                out.push("|")
            },
            onCloseTaggedUnion: () => {
                //
            },
            onOpenArray: (_openCharacterRange, openCharacter) => {
                out.push(openCharacter)
            },
            onCloseArray: (_closeCharacterRange, closeCharacter) => {
                out.push(closeCharacter)
            },
            onOpenObject: (_startRange, openCharacter) => {
                out.push(openCharacter)
            },
            onCloseObject: (_endRange, closeCharacter) => {
                out.push(closeCharacter)
            },
            onNewLine: () => {
                out.push("\n")
            },
            onWhitespace: value => {
                out.push(value)
            },
            //do the check
            onEnd: () => {
                if (!test.skipRoundTripCheck) {
                    assert.equal(chunks.join(""), out.join(""))
                }
            },
        }
        parser.onschemadata.subscribe(outputter)
        parser.onheaderdata.subscribe({
            onHeaderStart: () => {
                out.push("!")
            },
            onCompact: () => {
                out.push("#")
            },
            onHeaderEnd: () => {
                //
            },
        })
        parser.ondata.subscribe(outputter)

        if (strictJSON) {
            bc.attachStrictJSONValidator(parser, (v, _range) => {
                if (DEBUG) console.log("found JSON validation error", v)
                actualEvents.push(["validationerror", v])
            })
        }
        const eventSubscriber: bc.DataSubscriber = {
            onComma: () => {
                //
            },
            onColon: () => {
                //
            },
            onNewLine: () => {
                //
            },
            onWhitespace: () => {
                //
            },
            onLineComment: (v, range) => {
                if (DEBUG) console.log("found line comment")
                actualEvents.push(["linecomment", v, getRange(test.testForLocation, range)])
            },
            onBlockComment: (v, range, _indent) => {
                if (DEBUG) console.log("found block comment")
                actualEvents.push(["blockcomment", v, getRange(test.testForLocation, range)])
            },
            onUnquotedToken: (v, range) => {
                if (DEBUG) console.log("found unquoted token")
                actualEvents.push(["unquotedtoken", v, getRange(test.testForLocation, range)])
            },
            onQuotedString: (v, role, _quote, range) => {
                switch (role) {
                    case SimpleValueRole.KEY: {
                        if (DEBUG) console.log("found key")
                        actualEvents.push(["key", v, getRange(test.testForLocation, range)])
                        break
                    }
                    case SimpleValueRole.OPTION: {
                        if (DEBUG) console.log("found option")
                        actualEvents.push(["option", v, getRange(test.testForLocation, range)])
                        break
                    }
                    case SimpleValueRole.VALUE: {
                        if (DEBUG) console.log("found quoted string with role ''")
                        actualEvents.push(["quotedstring", v, getRange(test.testForLocation, range)])
                        break
                    }
                    default:
                        return assertUnreachable(role)
                }
            },

            onOpenTaggedUnion: range => {
                if (DEBUG) console.log("found open tagged union")
                actualEvents.push(["opentaggedunion", getRange(test.testForLocation, range)])
            },
            onCloseTaggedUnion: () => {
                if (DEBUG) console.log("found close tagged union")
                actualEvents.push(["closetaggedunion"])
            },
            onOpenArray: (range, v) => {
                if (DEBUG) console.log("found open array")
                actualEvents.push(["openarray", v, getRange(test.testForLocation, range)])
            },
            onCloseArray: (range, v) => {
                if (DEBUG) console.log("found close array")
                actualEvents.push(["closearray", v, getRange(test.testForLocation, range)])
            },
            onOpenObject: (range, v) => {
                if (DEBUG) console.log("found open object")
                actualEvents.push(["openobject", v, getRange(test.testForLocation, range)])
            },
            onCloseObject: (range, v) => {
                if (DEBUG) console.log("found close object")
                actualEvents.push(["closeobject", v, getRange(test.testForLocation, range)])
            },
            onEnd: location => {
                if (DEBUG) console.log("found end")
                actualEvents.push(["end", getLocation(test.testForLocation, location)])
                chai.assert.deepEqual(actualEvents, expectedEvents)
            },
        }
        parser.onschemadata.subscribe(eventSubscriber)
        parser.ondata.subscribe(eventSubscriber)

        bc.tokenizeStrings(
            parser,
            (message, _location) => {
                if (DEBUG) console.log("found error")

                actualEvents.push(["tokenizererror", message])
            },
            chunks
        )
    };
}

type Offset = {
    position: number
    offset: number
}

class Doc implements bc.DocumentAPI {
    private readonly offsets: Offset[] = []
    private content: string
    constructor(content: string) {
        this.content = content
    }
    getContent() {
        return this.content
    }
    remove(begin: number, end: number) {
        const content = this.content
        const beginoffset = this.getOffset(begin)
        const endoffset = this.getOffset(end)
        this.content = content.substr(0, beginoffset) + content.substr(endoffset)

        this.offsets.push({ position: end, offset: begin - end })
    }
    insert(position: number, value: string) {
        const content = this.content
        const offset = this.getOffset(position)
        this.content = content.substr(0, offset) + value + content.substr(offset)

        this.offsets.push({ position: position, offset: value.length })
    }
    replace(begin: number, end: number, value: string) {

        const content = this.content
        const beginoffset = this.getOffset(begin)
        const endoffset = this.getOffset(end)
        this.content = content.substr(0, beginoffset) + value + content.substr(endoffset)

        this.offsets.push({ position: end, offset: begin - end + value.length })
    }
    private getOffset(position: number) {
        let newPosition = position
        this.offsets.forEach(offset => {
            if (position > offset.position) {
                newPosition += offset.offset
            }
        })
        return newPosition
    }
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
    describe('#expect', () => {
        function doTest(data: string, callback: (expect: bc.ExpectContext) => bc.ValueHandler, expectedErrors: string[]) {
            const foundErrors: string[] = []
            const onError = (message: string, _range: bc.Range) => {
                foundErrors.push(message)
            }
            const onWarning = (message: string, _range: bc.Range) => {
                foundErrors.push(message)
            }
            const parser = new bc.Parser(
                onError,
            )
            const expect = new bc.ExpectContext(onError, onWarning)
            parser.ondata.subscribe(bc.createStackedDataSubscriber(
                callback(expect),
                err => {
                    foundErrors.push(err.message)
                },
                () => {
                    //do nothing with end
                },
            ))
            bc.tokenizeString(
                parser,
                (message, _location) => {
                    foundErrors.push(message)
                },
                data,
                {}
            )

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
        it('tagged union', () => {
            doTest(
                `( "a": | "foo" () )`,
                expect => expect.expectType(
                    () => {
                        //
                    },
                    {
                        a: () => expect.expectTaggedUnion(
                            {
                                foo: () => expect.expectType(
                                    () => {
                                        //
                                    },
                                    {
                                        //
                                    },
                                    () => {
                                        //
                                    }
                                ),
                            },
                        ),
                    },
                    () => {
                        //
                    },
                ),
                []
            )
        })

    });
    describe('#format', () => {
        function doTest(unformatted: string, expectedFormatted: string) {
            const foundErrors: string[] = []
            const onError = (message: string, _range: bc.Range) => {
                foundErrors.push(message)
            }
            // const onWarning = (message: string, _range: bc.Range) => {
            //     foundErrors.push(message)
            // }
            const parser = new bc.Parser(
                onError,
            )
            const doc = new Doc(unformatted)
            bc.attachFormatter(parser, doc, () => {
                chai.assert.equal(doc.getContent(), expectedFormatted)
            })
            bc.tokenizeString(
                parser,
                (message, _location) => {
                    foundErrors.push(message)
                },
                unformatted,
                {}
            )

        }

        const tests: { [key: string]: [string, string] } = {
            "some document": [
                `{"a"  :( ),"a" :( ) } `,
                `{ "a": (), "a": ()}\n`,
            ],
            "newline": [
                `{\r\n"a"  :( ),"a" :( ) } `,
                `{\r\n\t"a": (), "a": ()\n}\n`,
            ],
            "newline, too much indent": [
                `{\r\n\t\t\t"a"  :( ),"a" :( ) } `,
                `{\r\n\t"a": (), "a": ()\n}\n`,
            ],
            "lots of arrays": [
                `[[[[\r\n"A"]]\r\n]\r\n\t]`,
                `[[[[\r\n\t"A"\n]]]]\n`,
            ],
        }

        Object.keys(tests).forEach(testName => {
            const test = tests[testName]

            it(testName, () => {
                doTest(test[0], test[1])
            })
        })

    });
});
