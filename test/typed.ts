/* eslint
    no-console:"off",
    complexity: "off",
*/
import * as p from "pareto"
import * as p20 from "pareto-20"
import { describe } from "mocha"
import * as chai from "chai"
import * as bct from "../src"
import { getEndLocationFromRange, ExpectError, printExpectError, ParserAnnotationData } from "../src"

//const selectedJSONTests: string[] = ["two keys"]
//const selectedExtensionTests: string[] = []

// type Offset = {
//     position: number
//     offset: number
// }

type ErrorLine = [string, string, number, number, number, number]

// function getOnMissingAndOnInvalid(
//     valueType: ValueType,
// ): OnMissingAndOnInvalid {
//     return {
//         onMissing: valueType[2]?.onMissing,
//         onInvalidType: valueType[2]?.onInvalidType,
//     }
// }

describe('typed', () => {
    describe('#expect', () => {
        function doTest(
            testName: string,
            data: string,
            callback: (
                expect: bct.ExpectContext<ParserAnnotationData>,
                addError: (errorLine: ErrorLine) => void
            ) => bct.RequiredValueHandler<ParserAnnotationData>,
            expectedErrors: ErrorLine[]
        ) {

            it(testName, () => {
                const foundErrors: ErrorLine[] = []
                const onWarning = (issue: ExpectError, annotation: ParserAnnotationData) => {
                    const end = getEndLocationFromRange(annotation.range)
                    foundErrors.push(["expect warning", printExpectError(issue), annotation.range.start.line, annotation.range.start.column, end.line, end.column])
                }
                const streamTokenizer = bct.createParserStack(
                    () => {

                        return {
                            onData: () => {
                                return p.value(false)
                            },
                            onEnd: () => {
                                return p.success(null)

                            },
                        }
                    },
                    () => {

                        const expect = new bct.ExpectContext(
                            (issue: ExpectError, annotation: ParserAnnotationData) => {
                                const end = getEndLocationFromRange(annotation.range)
                                foundErrors.push(["expect error", printExpectError(issue), annotation.range.start.line, annotation.range.start.column, end.line, end.column])
                            },
                            onWarning,
                            bct.createDummyValueHandler,
                            bct.createDummyValueHandler,
                            bct.Severity.warning,
                            bct.OnDuplicateEntry.ignore,
                        )
                        return bct.createStackedParser(
                            callback(
                                expect,
                                errorLine => {
                                    foundErrors.push(errorLine)
                                }
                            ),
                            (err, range) => {
                                const end = getEndLocationFromRange(range)

                                foundErrors.push(["stacked error", err[0], range.start.line, range.start.column, end.line, end.column])
                            },
                            () => {
                                //do nothing with end
                                return p.success(null)
                            },
                        )
                    },
                    (error, range) => {
                        const end = getEndLocationFromRange(range)
                        foundErrors.push(["parser error", bct.printParsingError(error), range.start.line, range.start.column, end.line, end.column])
                    },
                )
                return p20.createArray([data]).streamify().tryToConsume(
                    null,
                    streamTokenizer,
                ).reworkAndCatch(
                    _error => {
                        throw new Error("unexpected")
                    },
                    _result => {
                        return p.value(null)
                    }
                ).convertToNativePromise().then(() => {
                    chai.assert.deepEqual(foundErrors, expectedErrors)
                })
            })
        }

        doTest(
            'duplicate entry',
            `{ "a": (), "a": () }`,
            expect => expect.expectValue(
                expect.expectDictionary(
                    () => {
                        //
                    },
                    () => {
                        return {
                            onExists: expect.expectType({}),
                            onMissing: () => {
                                //
                            },
                        }
                    },
                    () => {
                        //
                    },
                )
            ),
            [
                ["expect warning", "duplicate entry: 'a'", 1, 12, 1, 15],
            ]
        )
        doTest(
            'duplicate property',
            `( "a": 42, "a": 42 )`,
            expect => bct.createRequiredValueHandler(
                expect,
                ["type", {
                    a: (): bct.ValueType<ParserAnnotationData> => {
                        return ["number", () => {
                            return p.value(false)
                        }]
                    },
                }]
            ),
            [
                ["expect warning", "duplicate property: 'a'", 1, 12, 1, 15],
            ]
        )
        doTest(
            'unexpected boolean',

            `( "a": true )`,
            (expect, addError) => bct.createRequiredValueHandler(
                expect,
                [
                    "type",
                    {
                        a: (): bct.ValueType<ParserAnnotationData> => {
                            return [
                                "number",
                                () => {
                                    //console.log(value)
                                    return p.value(false)
                                },
                                {
                                    onInvalidType: () => {
                                        //addError(["stacked error", err.rangeLessMessage, $.start.line, $.start.column, $.end.line, $.end.column])
                                        addError(["invalid type", "TBD", 0, 0, 0, 0])
                                    },
                                },
                            ]
                        },
                    },
                ]
            ),
            [
                ["invalid type", "TBD", 0, 0, 0, 0],
            ]
        )

        doTest(
            'unexpected empty type',
            `( )`,
            (expect, addError) => bct.createRequiredValueHandler(
                expect,
                [
                    "type",
                    {
                        a: (): bct.ValueType<ParserAnnotationData> => {
                            return [
                                "number",
                                () => {
                                    //console.log(value)
                                    return p.value(false)
                                },
                                {
                                    onInvalidType: () => {
                                        //addError(["stacked error", err.rangeLessMessage, $.start.line, $.start.column, $.end.line, $.end.column])
                                        addError(["invalid type", "TBD", 0, 0, 0, 0])
                                    },
                                },
                            ]
                        },
                    },
                ]
            ),
            [
                ["expect error", "missing property: 'a'", 1, 1, 1, 2],
            ]
        )
        doTest(
            'unexpected object',
            `{ }`,
            (expect, _addError) => bct.createRequiredValueHandler(
                expect,
                [
                    "list",
                    ["number", () => {
                        return p.value(false)
                    }],
                    {
                        onBegin: () => {
                            //
                        },
                        onEnd: () => {
                            //
                        },
                    },
                ]
            ),
            [
                ["expect error", "expected a list ( [] ) but found an object ( {} or () )", 1, 1, 1, 2],
            ]
        )

        doTest(
            'tagged union',
            `( "a": | "foo" () )`,
            expect => expect.expectValue(
                expect.expectType(
                    {
                        a: {
                            onExists: () => {
                                return {
                                    onExists: expect.expectTaggedUnion(
                                        {
                                            foo: () => {
                                                return {
                                                    onExists: expect.expectType(
                                                        {
                                                            //
                                                        },
                                                    ),
                                                    onMissing: () => {
                                                        //
                                                    },
                                                }
                                            },
                                        },
                                        () => {
                                            //
                                        },
                                        () => {
                                            //
                                        },
                                    ),
                                    onMissing: () => {
                                        //
                                    },
                                }
                            },
                            onNotExists: null,
                        },
                    },
                ),
            ),
            []
        )
        doTest(
            'invalid tagged union',
            `( "a": | "foo" )`,
            (expect, addError) => expect.expectValue(
                expect.expectType(
                    {
                        a: {
                            onExists: (): bct.RequiredValueHandler<ParserAnnotationData> => {
                                return {
                                    onExists: expect.expectTaggedUnion(
                                        {
                                            foo: () => {
                                                return {
                                                    onExists: expect.expectType(),
                                                    onMissing: () => {
                                                        addError(["missing", "TBD", 0, 0, 0, 0])
                                                    },
                                                }
                                            },
                                        },
                                    ),
                                    onMissing: () => {
                                        //
                                    },
                                }
                            },
                            onNotExists: () => {
                                //
                            },
                        },
                    },
                    () => {
                        //
                    },
                ),
            ),
            [
                ["parser error", "not in an object", 1, 16, 1, 17],
                ["parser error", "unexpected end of document, still in tagged union", 1, 17, 1, 17],
                ["parser error", "unexpected end of document, still in object", 1, 17, 1, 17],
                ["missing", "TBD", 0, 0, 0, 0],
                ["stacked error", "missing tagged union value", 1, 16, 1, 17],
            ]
        )
    })
})
