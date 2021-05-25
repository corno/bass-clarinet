/* eslint
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import {
    RootState,
} from "./parserStateTypes"
import { Location, Range, printRange, getEndLocationFromRange, createRangeFromSingleLocation } from "./location"
import { TreeEvent, TreeEventType } from "./TreeEvent"
import * as Char from "./Characters"
import { TreeParser, TreeParserError, printTreeParserError } from "./TreeParser"
import { TokenType, Token, PunctionationData, SimpleValueData, OverheadToken } from "./Token"

const DEBUG = false

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

/**
 * a ParserEventConsumer is a IStreamConsumer.
 * the chunks are the individual TreeEvent's.
 * at the end, the location of the last character is sent ('Location').
 * The ReturnType and ErrorType are determined by the specific implementation.
 */
export type ParserEventConsumer<ReturnType, ErrorType> = p.IUnsafeStreamConsumer<TreeEvent, Location, ReturnType, ErrorType>

export type RootContext<ReturnType, ErrorType> = {
    state:
    | [RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE]
    | [RootState.EXPECTING_SCHEMA]
    | [RootState.PROCESSING_SCHEMA, {
        treeParser: TreeParser<null, null>
    }]
    | [RootState.EXPECTING_INSTANCE_DATA, {
    }]
    | [RootState.PROCESSING_INSTANCE_DATA, {
        treeParser: TreeParser<ReturnType, ErrorType>
    }]
    | [RootState.EXPECTING_END, {
        result: p.IUnsafeValue<ReturnType, ErrorType>
    }]
}

type StructureErrorType =
    | ["expected the schema start (!) or root value"]
    | ["expected the schema"]
    | ["expected rootvalue"]
    | ["unexpected data after end", {
        data: string
    }]

export type ParserError = {
    type:
    | ["body", TreeParserError]
    | ["structure", {
        type: StructureErrorType
    }]
}

export function printParserError(error: ParserError): string {
    switch (error.type[0]) {
        case "body": {
            const $$ = error.type[1]
            return printTreeParserError($$)
        }
        case "structure": {
            const $$ = error.type[1]
            switch ($$.type[0]) {
                case "expected rootvalue": {
                    return `expected rootvalue`
                }
                case "expected the schema": {
                    return `expected the schema`
                }
                case "expected the schema start (!) or root value": {
                    return `expected the schema start (!) or root value`
                }
                case "unexpected data after end": {
                    const $$$ = $$.type[1]
                    return `unexpected data after end: ${$$$.data}`
                }
                default:
                    return assertUnreachable($$.type[0])
            }
        }
        default:
            return assertUnreachable(error.type[0])
    }
}

export class Parser<ReturnType, ErrorType> {
    private readonly rootContext: RootContext<ReturnType, ErrorType> = { state: [RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE] }
    private readonly onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>
    private readonly onInstanceDataStart: (location: Location) => ParserEventConsumer<ReturnType, ErrorType>
    private readonly onerror: (error: ParserError, range: Range) => void
    /*
    a structure overhead token is a newline/whitspace/comment outside the content parts: (schema data, instance data)
    */
    private readonly onStructureOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean>
    constructor(
        onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
        onInstanceDataStart: (location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
        onerror: (error: ParserError, range: Range) => void,
        onStructureOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean>,
    ) {
        this.onSchemaDataStart = onSchemaDataStart
        this.onInstanceDataStart = onInstanceDataStart
        this.onerror = onerror
        this.onStructureOverheadToken = onStructureOverheadToken
    }
    public onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> {

        const range = createRangeFromSingleLocation(location)

        switch (this.rootContext.state[0]) {
            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: {
                //const $ = this.rootContext.state[1]

                this.raiseStructureError(["expected the schema start (!) or root value"], range)

                return this.onInstanceDataStart(location).onEnd(aborted, location)
            }
            case RootState.EXPECTING_SCHEMA: {
                //const $ = this.rootContext.state[1]

                this.raiseStructureError(["expected the schema"], range)
                return this.onInstanceDataStart(location).onEnd(aborted, location)
            }
            case RootState.PROCESSING_SCHEMA: {
                const $ = this.rootContext.state[1]
                return $.treeParser.forceEnd(aborted, location).reworkAndCatch(
                    () => {
                        return p.value(false)
                    },
                    () => {
                        return p.value(false)

                    }
                ).try(() => {
                    //this.raiseError("incomplete schema", range)
                    return this.onInstanceDataStart(location).onEnd(aborted, location)
                })
            }
            case RootState.EXPECTING_INSTANCE_DATA: {
                //const $ = this.rootContext.state[1]
                this.raiseStructureError(["expected rootvalue"], range)

                return this.onInstanceDataStart(location).onEnd(aborted, location)
            }
            case RootState.PROCESSING_INSTANCE_DATA: {
                const $ = this.rootContext.state[1]
                //this.raiseError("incomplete document", range)

                return $.treeParser.forceEnd(aborted, location)
            }
            case RootState.EXPECTING_END: {
                const $ = this.rootContext.state[1]
                return $.result
            }
            default:
                return assertUnreachable(this.rootContext.state[0])
        }
    }
    private handleToken(
        token: Token,
        onPunctuation: (data: PunctionationData) => p.IValue<boolean>,
        onSimpleValue: (simpleValueData: SimpleValueData) => p.IValue<boolean>,
    ): p.IValue<boolean> {
        switch (token.type[0]) {
            case TokenType.Overhead: {
                const $ = token.type[1]
                return this.onStructureOverheadToken($, token.range)
            }
            case TokenType.Punctuation: {
                const $ = token.type[1]
                return onPunctuation($)
            }
            case TokenType.SimpleValue: {
                const $ = token.type[1]
                return onSimpleValue($)
            }
            default:
                return assertUnreachable(token.type[0])
        }
    }
    public onData(data: Token): p.IValue<boolean> {
        switch (this.rootContext.state[0]) {
            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: {
                return this.handleToken(
                    data,
                    punctuation => {
                        switch (punctuation.char) {
                            case Char.Punctuation.exclamationMark:
                                this.rootContext.state = [RootState.EXPECTING_SCHEMA]
                                return p.value(false)
                            default:
                                return this.processComplexValueInstanceData(data, data.range)
                        }
                    },
                    simpleValue => {
                        return this.processSimpleValueInstanceData(simpleValue, data.range)
                    }
                )
            }
            case RootState.EXPECTING_SCHEMA: {
                return this.handleToken(
                    data,
                    _punctuation => {
                        const bp = new TreeParser(
                            (error, errorRange) => {
                                this.onerror(
                                    {
                                        type: ["body", error],
                                    },
                                    errorRange
                                )
                            },
                            this.onSchemaDataStart(data.range),
                        )
                        this.rootContext.state = [RootState.PROCESSING_SCHEMA, {
                            treeParser: bp,
                        }]
                        return bp.onData(data, result => {
                            this.rootContext.state = [RootState.EXPECTING_INSTANCE_DATA, {
                            }]
                            return result.reworkAndCatch(
                                () => {
                                    return p.value(false)
                                },
                                () => {
                                    return p.value(false)
                                }
                            )
                        })
                    },
                    simpleValue => {
                        const consumer = this.onSchemaDataStart(data.range)
                        return consumer.onData({
                            range: data.range,
                            type: [TreeEventType.SimpleValue, simpleValue],
                        }).mapResult(() => {

                            this.rootContext.state = [RootState.EXPECTING_INSTANCE_DATA, {
                            }]
                            return consumer.onEnd(false, getEndLocationFromRange(data.range)).reworkAndCatch(
                                () => {
                                    return p.value(false)
                                },
                                () => {
                                    return p.value(false)
                                },
                            )
                        })
                    }
                )
            }
            case RootState.PROCESSING_SCHEMA: {
                const $ = this.rootContext.state[1]

                return $.treeParser.onData(data, result => {
                    this.rootContext.state = [RootState.EXPECTING_INSTANCE_DATA, {}]
                    return result.reworkAndCatch(
                        () => {
                            return p.value(false)
                        },
                        () => {
                            return p.value(false)

                        }
                    )
                })

            }
            case RootState.EXPECTING_INSTANCE_DATA: {
                return this.handleToken(
                    data,
                    _punctuation => {
                        return this.processComplexValueInstanceData(data, data.range)
                    },
                    simpleValue => {
                        return this.processSimpleValueInstanceData(simpleValue, data.range)
                    }
                )
            }
            case RootState.PROCESSING_INSTANCE_DATA: {
                const $ = this.rootContext.state[1]

                return $.treeParser.onData(data, result => {
                    this.rootContext.state = [RootState.EXPECTING_END, { result: result }]
                    return p.value(false)
                })
            }
            case RootState.EXPECTING_END: {
                return this.handleToken(
                    data,
                    punctuation => {
                        this.raiseStructureError([`unexpected data after end`, {
                            data: String.fromCharCode(punctuation.char),
                        }], data.range)
                        return p.value(false)
                    },
                    simpleValue => {
                        this.raiseStructureError([`unexpected data after end`, {
                            data: simpleValue.value,
                        }], data.range)
                        return p.value(false)
                    }
                )
            }
            default:
                return assertUnreachable(this.rootContext.state[0])
        }
    }
    private processComplexValueInstanceData(data: Token, range: Range) {
        const bp = new TreeParser(
            (error, errorRange) => {
                this.onerror(
                    {
                        type: ["body", error],
                    },
                    errorRange
                )
            },
            this.onInstanceDataStart(range.start),
        )
        this.rootContext.state = [RootState.PROCESSING_INSTANCE_DATA, {
            treeParser: bp,
        }]
        return bp.onData(data, result => {
            this.rootContext.state = [RootState.EXPECTING_END, {
                result: result,
            }]
            return p.value(false)
        })
    }
    private processSimpleValueInstanceData(simpleValue: SimpleValueData, range: Range) {

        const consumer = this.onInstanceDataStart(range.start)
        return consumer.onData({
            range: range,
            type: [TreeEventType.SimpleValue, simpleValue],
        }).mapResult(() => {
            this.rootContext.state = [RootState.EXPECTING_END, {
                result: consumer.onEnd(false, getEndLocationFromRange(range)),
            }]
            return p.value(false)
        })

    }
    private raiseStructureError(type: StructureErrorType, range: Range) {
        if (DEBUG) { console.log("error raised:", type[0], printRange(range)) }
        this.onerror(
            {
                type: ["structure", {
                    type: type,
                }],
            },
            range)
    }
}

/**
 * A parser is used to build a certain type,
 * for this reason it has 2 type parameters:
 * -ReturnType: The type if parsing went succesful
 * -ErrorType: The type if the parsing produced an unexpected error
 * @param onSchemaDataStart a document can contain schema data. If this is the case, this callback will be called.
 * it enables the consuming code to prepare for the instance data. It cannot produce a result itself, hence the type parameters are null and null
 * @param onInstanceDataStart when the instance data starts, this callback is called and a ParserEventConsumer should be returned. This consumer will also produce the final resulting type
 * @param onerror a handler for when a parsing error occurs
 * @param onHeaderOverheadToken when a whitespace, newline or comment is encountered while parsing the header, this callback is called
 */
export function createParser<ReturnType, ErrorType>(
    onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
    onInstanceDataStart: (location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
    onerror: (error: ParserError, range: Range) => void,
    onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean>,
): Parser<ReturnType, ErrorType> {
    return new Parser(onSchemaDataStart, onInstanceDataStart, onerror, onHeaderOverheadToken)
}
