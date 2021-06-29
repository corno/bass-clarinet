import * as astn from "../.."
import * as astncore from "astn-core"
import * as p from "pareto"
import { SchemaSchemaBuilder } from "../../interfaces/deserialize"
import { SchemaAndSideEffects } from "../../interfaces/deserialize/SchemaAndSideEffects"
import { SchemaError } from "../../interfaces/deserialize/SchemaSchemaError"

export function createSchemaDeserializer(
    onError: (error: SchemaError, range: astn.Range) => void,
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<astn.TokenizerAnnotationData> | null,
): p.IUnsafeStreamConsumer<string, null, SchemaAndSideEffects<astn.TokenizerAnnotationData>, null> {
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
                    return p.success(null)
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
                        return p.error(null)
                    },
                }
            } else {
                if (schemaSchemaBuilder === null) {
                    if (!foundError) {
                        throw new Error("UNEXPECTED: SCHEMA PROCESSOR NOT SUBSCRIBED AND NO ERRORS")
                    }
                    return {
                        onData: () => {
                            //
                            return p.value(true)
                        },
                        onEnd: () => {
                            return p.error(null)
                        },
                    }
                } else {
                    return schemaSchemaBuilder(
                        (error, annotation2) => {
                            onError(["schema processing", error], annotation2.range)
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

