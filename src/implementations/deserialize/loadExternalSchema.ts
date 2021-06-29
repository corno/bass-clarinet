/* eslint
    "max-classes-per-file": off,
*/

import * as p from "pareto"


import { SchemaAndSideEffects } from "../../interfaces/deserialize/SchemaAndSideEffects"

import * as astncore from "astn-core"
import { RetrievalError, SchemaSchemaBuilder } from "../../interfaces/deserialize"
import { ExternalSchemaResolvingError, SchemaError } from "../../interfaces/deserialize/Errors"
import { TokenizerAnnotationData } from "../../interfaces"
import { createParserStack } from "../parser"
import { Range } from "../../generic"


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function createSchemaDeserializer(
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<TokenizerAnnotationData> | null,
    onError: (error: SchemaError, range: Range) => void,
    onSchema: (schema: SchemaAndSideEffects<TokenizerAnnotationData> | null) => p.IValue<null>,
    //SchemaAndSideEffects<TokenizerAnnotationData>,
): p.IStreamConsumer<string, null, null> {
    let foundError = false

    let schemaDefinitionFound = false
    let schemaSchemaBuilder: null | SchemaSchemaBuilder<TokenizerAnnotationData> = null
    function onSchemaError(error: SchemaError, range: Range) {
        onError(error, range)
        foundError = true
    }

    //console.log("SCHEMA DESER")
    return createParserStack({
        onEmbeddedSchema: (_schemaSchemaName, annotation) => {
            onSchemaError(["schema schema cannot be embedded"], annotation.range)
            return astncore.createStackedParser(
                astncore.createDummyTreeHandler(() => p.value(null)),
                _$ => {
                    return p.value(false)
                },
                () => {
                    return p.value(null)
                },
                () => astncore.createDummyValueHandler(() => p.value(null))
            )
        },
        onSchemaReference: (schemaSchemaReference, annotation) => {
            schemaDefinitionFound = true
            schemaSchemaBuilder = getSchemaSchemaBuilder(schemaSchemaReference.value)
            if (schemaSchemaBuilder === null) {
                console.error(`unknown schema schema '${schemaSchemaReference.value}'`)
                onSchemaError(["unknown schema schema", { name: schemaSchemaReference.value }], annotation.range)
            }
            return p.value(null)
        },
        onBody: annotation => {
            if (!schemaDefinitionFound) {
                //console.error("missing schema schema types")
                onSchemaError(["missing schema schema definition"], annotation.range)
                return {
                    onData: () => {
                        return p.value(false) //FIXME should be 'true', to abort
                    },
                    onEnd: () => {
                        return p.value(null)
                    },
                }
            } else {
                if (schemaSchemaBuilder === null) {
                    if (!foundError) {
                        throw new Error("UNEXPECTED: SCHEMA PROCESSOR NOT SUBSCRIBED AND NO ERRORS")
                    }
                    return {
                        onData: () => {
                            return p.value(true)
                        },
                        onEnd: () => {
                            return p.value(null)
                        },
                    }
                } else {
                    return schemaSchemaBuilder(
                        (error, annotation2) => {
                            onError(["schema processing", error], annotation2.range)
                        },
                        schemaAndSideEffects => {
                            return onSchema(schemaAndSideEffects)
                        }
                    )
                }
            }
        },
        errorStreams: {
            onTokenizerError: $ => {
                onSchemaError(["tokenizer", $.error], $.range)
            },
            onTextParserError: $ => {
                onSchemaError(["structure", $.error], $.annotation.range)
            },
            onTreeParserError: $ => {
                onSchemaError(["tree", $.error], $.annotation.range)
            },
        },
    })
}

export function loadPossibleExternalSchema(
    possibleStream: p.IUnsafeValue<p.IStream<string, null>, RetrievalError>,
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<TokenizerAnnotationData> | null,
    onError: (
        error: ExternalSchemaResolvingError
    ) => void,
): p.IUnsafeValue<SchemaAndSideEffects<TokenizerAnnotationData>, null> {

    return possibleStream.mapError(error => {
        switch (error[0]) {
            case "not found": {
                onError(["loading", {
                    message: "missing (valid) schema",
                }])
                return p.value(null)
            }
            case "other": {
                const $ = error[1]
                onError(["loading", {
                    message: `other: ${$.description}`,
                }])
                return p.value(null)
            }
            default:
                return assertUnreachable(error[0])
        }
    }).try(
        stream => {
            return loadExternalSchema(
                stream,
                getSchemaSchemaBuilder,
                onError,
            )
        }
    )
}

export function loadExternalSchema(
    stream: p.IStream<string, null>,
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<TokenizerAnnotationData> | null,
    onError: (
        error: ExternalSchemaResolvingError
    ) => void,
): p.IUnsafeValue<SchemaAndSideEffects<TokenizerAnnotationData>, null> {
    let foundErrors = false
    let schema: SchemaAndSideEffects<TokenizerAnnotationData> | null = null
    return stream.consume<null>(
        null,
        createSchemaDeserializer(
            getSchemaSchemaBuilder,
            _error => {
                foundErrors = true
                //console.error("SCHEMA ERROR", error)
            },
            $ => {
                schema = $
                return p.value(null)
            }
        ),
    ).try(
        () => {
            if (schema === null) {
                if (!foundErrors) {
                    throw new Error("no schema and no errors")
                }
                onError(["errors in referenced schema"])
                return p.error(null)
            } else {
                return p.success(schema)
            }
        },
    )
}