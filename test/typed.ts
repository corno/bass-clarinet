/* eslint
    no-console:"off",
    complexity: "off",
*/
import * as p from "pareto"
import * as p20 from "pareto-20"
import { describe } from "mocha"
import * as chai from "chai"
import * as astn from "../src"
import { IExpectContext } from "../src/interfaces/IExpectContext"

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
                expect: IExpectContext<astn.ParserAnnotationData, null>,
                addError: (errorLine: ErrorLine) => void
            ) => astn.ParserRequiredValueHandler,
            expectedErrors: ErrorLine[]
        ) {

            it(testName, () => {
                const foundErrors: ErrorLine[] = []
                const onWarning = ($: {
                    issue: astn.ExpectError
                    annotation: astn.ParserAnnotationData
                }) => {
                    const end = astn.getEndLocationFromRange($.annotation.range)
                    foundErrors.push(["expect warning", astn.printExpectError($.issue), $.annotation.range.start.line, $.annotation.range.start.column, end.line, end.column])
                }
                const streamTokenizer = astn.createParserStack(
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

                        const expect = astn.createExpectContext<astn.ParserAnnotationData, null>(
                            $ => {
                                const end = astn.getEndLocationFromRange($.annotation.range)
                                foundErrors.push(["expect error", astn.printExpectError($.issue), $.annotation.range.start.line, $.annotation.range.start.column, end.line, end.column])
                            },
                            onWarning,
                            astn.createDummyValueHandler,
                            astn.createDummyValueHandler,
                            astn.Severity.warning,
                            astn.OnDuplicateEntry.ignore,
                        )
                        return astn.createStackedParser(
                            {
                                root: callback(
                                    expect,
                                    errorLine => {
                                        foundErrors.push(errorLine)
                                    }
                                ),
                            },
                            (err, range) => {
                                const end = astn.getEndLocationFromRange(range)

                                foundErrors.push(["stacked error", err[0], range.start.line, range.start.column, end.line, end.column])
                            },
                            () => {
                                //do nothing with end
                                return p.success(null)
                            },
                        )
                    },
                    (error, range) => {
                        const end = astn.getEndLocationFromRange(range)
                        foundErrors.push(["parser error", astn.printParsingError(error), range.start.line, range.start.column, end.line, end.column])
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
                            exists: expect.expectType({}),
                            missing: () => {
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
            expect => astn.createRequiredValueHandler(
                expect,
                ["type", {
                    a: (): astn.ValueType<astn.ParserAnnotationData, null> => {
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
            (expect, addError) => astn.createRequiredValueHandler(
                expect,
                [
                    "type",
                    {
                        a: (): astn.ValueType<astn.ParserAnnotationData, null> => {
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
            (expect, addError) => astn.createRequiredValueHandler(
                expect,
                [
                    "type",
                    {
                        a: (): astn.ValueType<astn.ParserAnnotationData, null> => {
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
            (expect, _addError) => astn.createRequiredValueHandler(
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
                                    exists: expect.expectTaggedUnion(
                                        {
                                            foo: () => {
                                                return {
                                                    exists: expect.expectType(
                                                        {
                                                            //
                                                        },
                                                    ),
                                                    missing: () => {
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
                                    missing: () => {
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
                            onExists: (): astn.RequiredValueHandler<astn.ParserAnnotationData, null> => {
                                return {
                                    exists: expect.expectTaggedUnion(
                                        {
                                            foo: () => {
                                                return {
                                                    exists: expect.expectType({}),
                                                    missing: () => {
                                                        addError(["missing", "TBD", 0, 0, 0, 0])
                                                    },
                                                }
                                            },
                                        },
                                    ),
                                    missing: () => {
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
