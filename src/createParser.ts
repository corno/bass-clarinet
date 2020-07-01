/* eslint
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import {
    RootState,
} from "./parserStateTypes"
import { Location, Range, printRange, getEndLocationFromRange, createRangeFromSingleLocation } from "./location"
import { BodyEvent, BodyEventType } from "./BodyEvent"
import * as Char from "./Characters"
import { BodyParser } from "./BodyParser"
import { TokenType, Token, PunctionationData, SimpleValueData, OverheadToken } from "./Token"

const DEBUG = false

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export type ParserEventConsumer<ReturnType, ErrorType> = p.IStreamConsumer<BodyEvent, Location, ReturnType, ErrorType>

export type RootContext<ReturnType, ErrorType> = {
    state:
    | [RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE]
    | [RootState.EXPECTING_SCHEMA]
    | [RootState.PROCESSING_SCHEMA, {
        bodyParser: BodyParser<null, null>
    }]
    | [RootState.EXPECTING_HASH_OR_INSTANCE_DATA, {
    }]
    | [RootState.EXPECTING_INSTANCE_DATA_AFTER_HASH, {
        hashRange: Range
    }]
    | [RootState.PROCESSING_INSTANCE_DATA, {
        bodyParser: BodyParser<ReturnType, ErrorType>
    }]
    | [RootState.EXPECTING_END, {
        result: p.IUnsafeValue<ReturnType, ErrorType>
    }]
}


export class Parser<ReturnType, ErrorType> {
    private readonly rootContext: RootContext<ReturnType, ErrorType> = { state: [RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE] }
    private readonly onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>
    private readonly onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>
    private readonly onerror: (message: string, range: Range) => void
    private readonly onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean>
    constructor(
        onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
        onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
        onerror: (message: string, range: Range) => void,
        onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean>,
    ) {
        this.onSchemaDataStart = onSchemaDataStart
        this.onInstanceDataStart = onInstanceDataStart
        this.onerror = onerror
        this.onHeaderOverheadToken = onHeaderOverheadToken
    }
    public onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType> {

        const range = createRangeFromSingleLocation(location)

        switch (this.rootContext.state[0]) {
            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: {
                //const $ = this.rootContext.state[1]

                this.raiseError("expected the schema start (!) or root value", range)

                return this.onInstanceDataStart(null, location).onEnd(aborted, location)
            }
            case RootState.EXPECTING_SCHEMA: {
                //const $ = this.rootContext.state[1]

                this.raiseError("expected the schema", range)
                return this.onInstanceDataStart(null, location).onEnd(aborted, location)
            }
            case RootState.PROCESSING_SCHEMA: {
                const $ = this.rootContext.state[1]
                return $.bodyParser.forceEnd(aborted, location).reworkAndCatch(
                    () => {
                        return p.result(false)
                    },
                    () => {
                        return p.result(false)

                    }
                ).try(() => {
                    //this.raiseError("incomplete schema", range)
                    return this.onInstanceDataStart(null, location).onEnd(aborted, location)
                })
            }
            case RootState.EXPECTING_HASH_OR_INSTANCE_DATA: {
                //const $ = this.rootContext.state[1]
                this.raiseError("expected '#' or rootvalue", range)

                return this.onInstanceDataStart(null, location).onEnd(aborted, location)
            }
            case RootState.EXPECTING_INSTANCE_DATA_AFTER_HASH: {
                //const $ = this.rootContext.state[1]
                this.raiseError("expected rootvalue", range)
                return this.onInstanceDataStart(null, location).onEnd(aborted, location)
            }
            case RootState.PROCESSING_INSTANCE_DATA: {
                const $ = this.rootContext.state[1]
                //this.raiseError("incomplete document", range)

                return $.bodyParser.forceEnd(aborted, location)
            }
            case RootState.EXPECTING_END: {
                const $ = this.rootContext.state[1]
                return $.result
            }
            default:
                return assertUnreachable(this.rootContext.state[0])
        }
    }
    private handlePreEvent(
        data: Token,
        onPunctuation: (data: PunctionationData) => p.IValue<boolean>,
        onSimpleValue: (simpleValueData: SimpleValueData) => p.IValue<boolean>,
    ): p.IValue<boolean> {
        switch (data.type[0]) {
            case TokenType.Overhead: {
                const $ = data.type[1]
                return this.onHeaderOverheadToken($, data.range)
            }
            case TokenType.Punctuation: {
                const $ = data.type[1]
                return onPunctuation($)
            }
            case TokenType.SimpleValue: {
                const $ = data.type[1]
                return onSimpleValue($)
            }
            default:
                return assertUnreachable(data.type[0])
        }
    }
    public onData(data: Token): p.IValue<boolean> {
        switch (this.rootContext.state[0]) {
            case RootState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: {
                return this.handlePreEvent(
                    data,
                    punctuation => {
                        switch (punctuation.char) {
                            case Char.Punctuation.exclamationMark:
                                this.rootContext.state = [RootState.EXPECTING_SCHEMA]
                                return p.result(false)
                            case Char.Punctuation.hash:
                                this.rootContext.state = [RootState.EXPECTING_INSTANCE_DATA_AFTER_HASH, {
                                    hashRange: data.range,
                                }]
                                return p.result(false)
                            default:
                                return this.processComplexValueInstanceData(data, null, data.range)
                        }
                    },
                    simpleValue => {
                        return this.processSimpleValueInstanceData(simpleValue, data.range)
                    }
                )
            }
            case RootState.EXPECTING_SCHEMA: {
                return this.handlePreEvent(
                    data,
                    _punctuation => {
                        const bp = new BodyParser(
                            this.onerror,
                            this.onSchemaDataStart(data.range),
                        )
                        this.rootContext.state = [RootState.PROCESSING_SCHEMA, {
                            bodyParser: bp,
                        }]
                        return bp.onData(data, result => {
                            this.rootContext.state = [RootState.EXPECTING_HASH_OR_INSTANCE_DATA, {
                            }]
                            return result.reworkAndCatch(
                                () => {
                                    return p.result(false)
                                },
                                () => {
                                    return p.result(false)
                                }
                            )
                        })
                    },
                    simpleValue => {
                        const consumer = this.onSchemaDataStart(data.range)
                        return consumer.onData({
                            range: data.range,
                            type: [BodyEventType.SimpleValue, simpleValue],
                        }).mapResult(() => {

                            this.rootContext.state = [RootState.EXPECTING_HASH_OR_INSTANCE_DATA, {
                            }]
                            return consumer.onEnd(false, getEndLocationFromRange(data.range)).reworkAndCatch(
                                () => {
                                    return p.result(false)
                                },
                                () => {
                                    return p.result(false)
                                },
                            )
                        })
                    }
                )
            }
            case RootState.PROCESSING_SCHEMA: {
                const $ = this.rootContext.state[1]

                return $.bodyParser.onData(data, result => {
                    this.rootContext.state = [RootState.EXPECTING_HASH_OR_INSTANCE_DATA, {}]
                    return result.reworkAndCatch(
                        () => {
                            return p.result(false)
                        },
                        () => {
                            return p.result(false)

                        }
                    )
                })

            }
            case RootState.EXPECTING_HASH_OR_INSTANCE_DATA: {
                return this.handlePreEvent(
                    data,
                    punctuation => {
                        if (punctuation.char === Char.Punctuation.hash) {
                            this.rootContext.state = [RootState.EXPECTING_INSTANCE_DATA_AFTER_HASH, {
                                hashRange: data.range,
                            }]
                            return p.result(false)
                        } else {
                            return this.processComplexValueInstanceData(data, null, data.range)
                        }
                    },
                    simpleValue => {
                        return this.processSimpleValueInstanceData(simpleValue, data.range)
                    }
                )
            }
            case RootState.EXPECTING_INSTANCE_DATA_AFTER_HASH: {
                const $ = this.rootContext.state[1]
                return this.handlePreEvent(
                    data,
                    _punctuation => {
                        return this.processComplexValueInstanceData(data, $.hashRange, data.range)
                    },
                    simpleValue => {
                        return this.processSimpleValueInstanceData(simpleValue, data.range)
                    }
                )
            }
            case RootState.PROCESSING_INSTANCE_DATA: {
                const $ = this.rootContext.state[1]

                return $.bodyParser.onData(data, result => {
                    this.rootContext.state = [RootState.EXPECTING_END, { result: result }]
                    return p.result(false)
                })
            }
            case RootState.EXPECTING_END: {
                return this.handlePreEvent(
                    data,
                    punctuation => {
                        this.raiseError(`unexpected data after end: '${String.fromCharCode(punctuation.char)}'`, data.range)
                        return p.result(false)
                    },
                    simpleValue => {
                        this.raiseError(`unexpected data after end: '${simpleValue.value}'`, data.range)
                        return p.result(false)
                    }
                )
            }
            default:
                return assertUnreachable(this.rootContext.state[0])
        }
    }
    private processComplexValueInstanceData(data: Token, compact: null | Range, range: Range) {
        const bp = new BodyParser(
            this.onerror,
            this.onInstanceDataStart(null, range.start),
        )
        this.rootContext.state = [RootState.PROCESSING_INSTANCE_DATA, {
            bodyParser: bp,
        }]
        return bp.onData(data, result => {
            this.rootContext.state = [RootState.EXPECTING_END, {
                result: result,
            }]
            return p.result(false)
        })
    }
    private processSimpleValueInstanceData(simpleValue: SimpleValueData, range: Range) {

        const consumer = this.onInstanceDataStart(null, range.start)
        return consumer.onData({
            range: range,
            type: [BodyEventType.SimpleValue, simpleValue],
        }).mapResult(() => {
            this.rootContext.state = [RootState.EXPECTING_END, {
                result: consumer.onEnd(false, getEndLocationFromRange(range)),
            }]
            return p.result(false)
        })

    }
    private raiseError(message: string, range: Range) {
        if (DEBUG) { console.log("error raised:", message, printRange(range)) }
        this.onerror(message, range)
    }
}


export function createParser<ReturnType, ErrorType>(
    onSchemaDataStart: (range: Range) => ParserEventConsumer<null, null>,
    onInstanceDataStart: (compact: null | Range, location: Location) => ParserEventConsumer<ReturnType, ErrorType>,
    onerror: (message: string, range: Range) => void,
    onHeaderOverheadToken: (token: OverheadToken, range: Range) => p.IValue<boolean>,
): Parser<ReturnType, ErrorType> {
    return new Parser(onSchemaDataStart, onInstanceDataStart, onerror, onHeaderOverheadToken)
}
