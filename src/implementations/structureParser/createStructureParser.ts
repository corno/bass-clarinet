/* eslint
    no-console:"off",
    max-classes-per-file:"off",
*/
import * as p from "pareto"
import * as core from "astn-core"
import * as Char from "../../generic/characters"
import { createTreeParser, TreeParserError as TreeError } from "../treeParser"
import { StructureErrorType as StructureErrorType } from "./functionTypes"
import { ITreeParser, MultilineStringData, StructuralTokenData, SimpleStringData, Token, TokenType } from "../../interfaces/ITreeParser"
import { TokenConsumer } from "../../interfaces/ITokenConsumer"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

enum TextState {
    EXPECTING_SCHEMA_START_OR_ROOT_VALUE,
    EXPECTING_SCHEMA,
    PROCESSING_SCHEMA,
    EXPECTING_BODY,
    PROCESSING_BODY,
    EXPECTING_END, // no more input expected}

}

/**
 * A parser is used to build a certain type,
 * for this reason it has 2 type parameters:
 * -ReturnType: The type if parsing went succesful
 * -ErrorType: The type if the parsing produced an unexpected error
 * @param onEmbeddedSchema a text can contain schema data. If this is the case, this callback will be called.
 * it enables the consuming code to prepare for the instance data. It cannot produce a result itself, hence the type parameters are null and null
 * @param onInstanceDataStart when the instance data starts, this callback is called and a TextParserEventConsumer should be returned. This consumer will also produce the final resulting type
 * @param onTextParserError a handler for when a parsing error occurs
 * @param onHeaderOverheadToken when a whitespace, newline or comment is encountered while parsing the header, this callback is called
 */
export function createStructureParser<Annotation, ReturnType, ErrorType>($: {
    onEmbeddedSchema: (schemaSchemaName: string, firstTokenAnnotation: Annotation) => core.ITreeBuilder<Annotation, null, null>
    onSchemaReference: (token: SimpleStringData, tokenAnnotation: Annotation) => p.IValue<null>
    onBody: (annotation: Annotation) => core.ITreeBuilder<Annotation, ReturnType, ErrorType>
    onTextParserError: ($: {
        error: StructureErrorType
        annotation: Annotation
    }) => void
    onTreeParserError: ($: {
        error: TreeError
        annotation: Annotation
    }) => void
}): TokenConsumer<Annotation, ReturnType, ErrorType> {

    type RootContext = {
        state:
        | [TextState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE]
        | [TextState.EXPECTING_SCHEMA]
        | [TextState.PROCESSING_SCHEMA, {
            treeParser: ITreeParser<Annotation, null, null>
        }]
        | [TextState.EXPECTING_BODY, {
        }]
        | [TextState.PROCESSING_BODY, {
            treeParser: ITreeParser<Annotation, ReturnType, ErrorType>
        }]
        | [TextState.EXPECTING_END, {
            result: p.IUnsafeValue<ReturnType, ErrorType>
        }]
    }
    // function createAnnotation(token: Token<ParserAnnotationData>): ParserAnnotationData {
    //     return {
    //         tokenString: token.tokenString,
    //         indentation: "",
    //         range: token.range,
    //         contextData: {
    //             before: {
    //                 comments: [],
    //             },
    //             lineCommentAfter: null,
    //         },

    //     }
    // }

    // function createEndAnnotation2(location: Location): ParserAnnotationData {
    //     return {
    //         tokenString: "",
    //         indentation: "",
    //         range: createRangeFromSingleLocation(location),
    //         contextData: {
    //             before: {
    //                 comments: [],
    //             },
    //             lineCommentAfter: null,
    //         },

    //     }
    // }
    class TextParser {
        private readonly rootContext: RootContext = { state: [TextState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE] }
        /*
        a structure overhead token is a newline/whitspace/comment outside the content parts: (schema data, instance data)
        */
        public onEnd(aborted: boolean, annotation: Annotation): p.IUnsafeValue<ReturnType, ErrorType> {

            switch (this.rootContext.state[0]) {
                case TextState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: {
                    //const $ = this.rootContext.state[1]

                    this.raiseStructureError(["expected the schema start (!) or root value"], annotation)

                    return $.onBody(annotation).onEnd(aborted, annotation)
                }
                case TextState.EXPECTING_SCHEMA: {
                    //const $ = this.rootContext.state[1]

                    this.raiseStructureError(["expected the schema"], annotation)
                    return $.onBody(annotation).onEnd(aborted, annotation)
                }
                case TextState.PROCESSING_SCHEMA: {
                    const $$ = this.rootContext.state[1]
                    return $$.treeParser.forceEnd(aborted, annotation).reworkAndCatch(
                        () => {
                            return p.value(false)
                        },
                        () => {
                            return p.value(false)

                        }
                    ).try(() => {
                        //this.raiseError("incomplete schema", range)
                        return $.onBody(annotation).onEnd(aborted, annotation)
                    })
                }
                case TextState.EXPECTING_BODY: {
                    //const $ = this.rootContext.state[1]
                    this.raiseStructureError(["expected rootvalue"], annotation)

                    return $.onBody(annotation).onEnd(aborted, annotation)
                }
                case TextState.PROCESSING_BODY: {
                    const $ = this.rootContext.state[1]
                    //this.raiseError("incomplete text", range)

                    return $.treeParser.forceEnd(aborted, annotation)
                }
                case TextState.EXPECTING_END: {
                    const $ = this.rootContext.state[1]
                    return $.result
                }
                default:
                    return assertUnreachable(this.rootContext.state[0])
            }
        }
        private handleToken(
            token: Token<Annotation>,
            onStructuralToken: (data: StructuralTokenData) => p.IValue<boolean>,
            onSimpleString: (stringData: SimpleStringData) => p.IValue<boolean>,
            onMultilineString: (stringData: MultilineStringData) => p.IValue<boolean>,
        ): p.IValue<boolean> {
            switch (token.type[0]) {
                case TokenType.Structural: {
                    const $ = token.type[1]
                    return onStructuralToken($)
                }
                case TokenType.SimpleString: {
                    const $ = token.type[1]
                    return onSimpleString($)
                }
                case TokenType.MultilineString: {
                    const $ = token.type[1]
                    return onMultilineString($)
                }
                default:
                    return assertUnreachable(token.type[0])
            }
        }
        public onData(data: Token<Annotation>): p.IValue<boolean> {
            switch (this.rootContext.state[0]) {
                case TextState.EXPECTING_SCHEMA_START_OR_ROOT_VALUE: {
                    return this.handleToken(
                        data,
                        punctuation => {
                            switch (punctuation.char) {
                                case Char.Punctuation.exclamationMark:
                                    this.rootContext.state = [TextState.EXPECTING_SCHEMA]
                                    return p.value(false)
                                default:
                                    return this.processComplexValueBodyData(data)
                            }
                        },
                        string => {
                            return this.processSimpleStringBodyData(string, data)
                        },
                        string => {
                            return this.processMultilineStringBodyData(string, data)
                        }
                    )
                }
                case TextState.EXPECTING_SCHEMA: {
                    return this.handleToken(
                        data,
                        _punctuation => {
                            console.error("FIXME schema schema reference")
                            const bp = createTreeParser(
                                $.onTreeParserError,
                                $.onEmbeddedSchema("mrshl/metadata@0.1", data.annotation),
                            )
                            this.rootContext.state = [TextState.PROCESSING_SCHEMA, {
                                treeParser: bp,
                            }]
                            return bp.onData(data, result => {
                                this.rootContext.state = [TextState.EXPECTING_BODY, {
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
                        stringData => {
                            return $.onSchemaReference(stringData, data.annotation).mapResult(() => {
                                this.rootContext.state = [TextState.EXPECTING_BODY, {
                                }]
                                return p.value(false)
                            })
                        },
                        _stringData => {
                            this.raiseStructureError([`expected a schema reference or a schema body`], data.annotation)
                            return p.value(false)
                        },
                    )
                }
                case TextState.PROCESSING_SCHEMA: {
                    const $ = this.rootContext.state[1]

                    return $.treeParser.onData(data, result => {
                        this.rootContext.state = [TextState.EXPECTING_BODY, {}]
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
                case TextState.EXPECTING_BODY: {
                    return this.handleToken(
                        data,
                        _punctuation => {
                            return this.processComplexValueBodyData(data)
                        },
                        string => {
                            return this.processSimpleStringBodyData(string, data)
                        },
                        string => {
                            return this.processMultilineStringBodyData(string, data)
                        },
                    )
                }
                case TextState.PROCESSING_BODY: {
                    const $ = this.rootContext.state[1]

                    return $.treeParser.onData(data, result => {
                        this.rootContext.state = [TextState.EXPECTING_END, { result: result }]
                        return p.value(false)
                    })
                }
                case TextState.EXPECTING_END: {
                    return this.handleToken(
                        data,
                        punctuation => {
                            this.raiseStructureError([`unexpected data after end`, {
                                data: String.fromCharCode(punctuation.char),
                            }], data.annotation)
                            return p.value(false)
                        },
                        string => {
                            this.raiseStructureError([`unexpected data after end`, {
                                data: string.value,
                            }], data.annotation)
                            return p.value(false)
                        },
                        string => {
                            this.raiseStructureError([`unexpected data after end`, {
                                data: string.lines.join("\n"),
                            }], data.annotation)
                            return p.value(false)
                        },
                    )
                }
                default:
                    return assertUnreachable(this.rootContext.state[0])
            }
        }
        private processComplexValueBodyData(data: Token<Annotation>) {
            const bp = createTreeParser(
                $.onTreeParserError,
                $.onBody(data.annotation),
            )
            this.rootContext.state = [TextState.PROCESSING_BODY, {
                treeParser: bp,
            }]
            return bp.onData(data, result => {
                this.rootContext.state = [TextState.EXPECTING_END, {
                    result: result,
                }]
                return p.value(false)
            })
        }
        private processSimpleStringBodyData(
            data2: SimpleStringData,
            token: Token<Annotation>,
        ) {

            const consumer = $.onBody(token.annotation)
            return consumer.onData({
                annotation: token.annotation,
                type: ["simple string", {
                    value: data2.value,
                    wrapping: data2.wrapping,
                }],
            }).mapResult(() => {
                this.rootContext.state = [TextState.EXPECTING_END, {
                    result: consumer.onEnd(false, token.annotation),
                }]
                return p.value(false)
            })

        }
        private processMultilineStringBodyData(
            data2: MultilineStringData,
            token: Token<Annotation>,
        ) {
            const consumer = $.onBody(token.annotation)
            return consumer.onData({
                annotation: token.annotation,
                type: ["multiline string", {
                    lines: data2.lines,

                }],
            }).mapResult(() => {
                this.rootContext.state = [TextState.EXPECTING_END, {
                    result: consumer.onEnd(false, token.annotation),
                }]
                return p.value(false)
            })

        }
        private raiseStructureError(type: StructureErrorType, annotation: Annotation) {
            $.onTextParserError(
                {
                    error: type,
                    annotation: annotation,
                },
            )
        }
    }
    return new TextParser()
}
