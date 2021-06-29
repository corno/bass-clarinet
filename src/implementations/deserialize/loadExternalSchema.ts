/* eslint
    "max-classes-per-file": off,
*/

import * as p from "pareto"
import * as astn from "../.."


import { SchemaAndSideEffects } from "../../interfaces/deserialize/SchemaAndSideEffects"

import * as astncore from "astn-core"
import { SchemaSchemaBuilder } from "../../interfaces/deserialize"
import { SchemaError } from "../../interfaces/deserialize/Errors"


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function createSchemaDeserializer(
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<astn.TokenizerAnnotationData> | null,
    onError: (error: SchemaError, range: astn.Range) => void,
    onSchema: (schema: SchemaAndSideEffects<astn.TokenizerAnnotationData>) => void,
    //SchemaAndSideEffects<astn.TokenizerAnnotationData>,
): p.IStreamConsumer<string, null, null> {
    let foundError = false

    let schemaDefinitionFound = false
    let schemaSchemaBuilder: null | SchemaSchemaBuilder<astn.TokenizerAnnotationData> = null
    function onSchemaError(error: SchemaError, range: astn.Range) {
        onError(error, range)
        foundError = true
    }

    //console.log("SCHEMA DESER")
    return astn.createParserStack({
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
                            onSchema(schemaAndSideEffects)
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

export function loadExternalSchema(
    possibleStream: p.IUnsafeValue<p.IStream<string, null>, astn.RetrievalError>,
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<astn.TokenizerAnnotationData> | null,
    onError: (
        error: astn.ExternalSchemaResolvingError
    ) => void,
    onSchema: (
        schema: astn.SchemaAndSideEffects<astn.TokenizerAnnotationData>
    ) => void,
): p.IValue<null> {
    return possibleStream.mapError(error => {
        switch (error[0]) {
            case "not found": {
                onError(["loading", {
                    message: "schema not found",
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
    }).try<null>(
        stream => {
            let foundErrors = false
            return stream.consume<null>(
                null,
                createSchemaDeserializer(
                    getSchemaSchemaBuilder,
                    error => {
                        foundErrors = true
                        console.error("SCHEMA ERROR", error)
                    },
                    schema => {
                        onSchema(schema)
                    }
                ),
            ).mapResult(
                () => {
                    if (foundErrors) {
                        onError(["errors in referenced schema"])
                    }
                    return p.value(null)
                },
            )
        },
    ).catch(() => {
        return p.value(null)
    })
}