/* eslint
    "max-classes-per-file": off,
*/

import * as p20 from "pareto-20"
import * as p from "pareto"
import * as astncore from "astn-core"
import * as astn from "../.."


import { InternalSchemaSpecification } from "../../interfaces/deserialize/Dataset"
import { SchemaAndSideEffects } from "../../interfaces/deserialize/SchemaAndSideEffects"

import { DeserializeError } from "../../interfaces/deserialize/Errors"
import { ResolveReferencedSchema } from "../../interfaces/deserialize/ResolveReferencedSchema"
import { SchemaSchemaBuilder } from "../../interfaces/deserialize"
import { DiagnosticSeverity } from "astn-core"
import { loadExternalSchema } from "./loadExternalSchema"

export type ResolvedSchema = {
    specification: InternalSchemaSpecification
    schemaAndSideEffects: SchemaAndSideEffects<astn.TokenizerAnnotationData>
}


/**
 * this function returns a promise to a deserialized dataset and the promise is resolved when the validation has been completed
 * @param serializedDataset
 * @param schemaReferenceResolver if the document contains a reference to a schema, this callback resolves the schema
 * @param onEmbeddedSchema if the document contains a schema (either reference or embedded), this callback is used to create the dataset
 * @param onNoEmbeddedSchema if the document does not contain a schema, this callback is used to create the dataset
 * @param onError
 * @param onWarning
 * @param sideEffectsHandlers these handlers will be called during the deserialization.
 * Can be used to create additional errors and warnings about the serialized document. For example missing properties or invalid formatting
 */
export function createDeserializer(
    contextSchema: SchemaAndSideEffects<astn.TokenizerAnnotationData> | null,
    resolveReferencedSchema: ResolveReferencedSchema,
    onError: (diagnostic: DeserializeError, range: astn.Range, severity: astncore.DiagnosticSeverity) => void,

    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<astn.TokenizerAnnotationData> | null,
    handlerBuilder: (
        schemaSpec: ResolvedSchema,
    ) => astncore.RootHandler<astn.TokenizerAnnotationData>,
): p20.IStreamConsumer<string, null, null> {

    let embeddedSchemaSpecificationStart: null | astn.Range = null
    let foundSchemaErrors = false

    let internalSchema: ResolvedSchema | null = null


    const parserStack = astn.createParserStack({
        onEmbeddedSchema: (schemaSchemaReference, firstTokenAnnotation) => {
            embeddedSchemaSpecificationStart = firstTokenAnnotation.range

            const schemaSchemaBuilder = getSchemaSchemaBuilder(schemaSchemaReference)

            if (schemaSchemaBuilder === null) {
                throw new Error(`IMPLEMENT ME: unknown schema schema: ${schemaSchemaReference}`)
            }
            const builder = schemaSchemaBuilder(
                (error, annotation) => {
                    onError(["embedded schema error", error], annotation.range, astncore.DiagnosticSeverity.error)
                    foundSchemaErrors = true
                },
                schemaAndSideEffects => {
                    internalSchema = {
                        schemaAndSideEffects: schemaAndSideEffects,
                        specification: ["embedded"],
                    }
                    return p.value(null)
                }
            )
            return {
                onData: data => builder.onData(data),
                onEnd: (aborted, data) => {
                    return builder.onEnd(aborted, data)
                },
            }
        },
        onSchemaReference: (schemaReference, annotation) => {
            return loadExternalSchema(
                resolveReferencedSchema(schemaReference.value),
                getSchemaSchemaBuilder,
                error => {
                    foundSchemaErrors = true
                    onError(
                        ["schema reference resolving", error],
                        annotation.range,
                        astncore.DiagnosticSeverity.error,
                    )
                    onError(
                        ["invalid schema reference"],
                        annotation.range,
                        astncore.DiagnosticSeverity.warning,
                    )
                },
            ).mapResult(schemaAndSideEffects => {
                internalSchema = {
                    schemaAndSideEffects: schemaAndSideEffects,
                    specification: ["reference", { name: schemaReference.value }],
                }
                return p.value(null)
            }).catch(() => {
                return p.value(null)
            })
        },
        onBody: firstBodyTokenAnnotation => {
            const dummyStackParser = astncore.createStackedParser<astn.TokenizerAnnotationData>(
                astncore.createDummyTreeHandler(() => p.value(null)),
                error => {
                    onError(["stacked", error.type], error.annotation.range, astncore.DiagnosticSeverity.error)
                },
                () => {
                    return p.value(null)
                },
                () => astncore.createDummyValueHandler(() => p.value(null))
            )
            if (contextSchema !== null) {
                if (embeddedSchemaSpecificationStart !== null) {
                    onError(
                        ["found both internal and context schema. ignoring internal schema"],
                        embeddedSchemaSpecificationStart,
                        DiagnosticSeverity.warning
                    )
                }
                const handler = handlerBuilder({
                    schemaAndSideEffects: contextSchema,
                    specification: ["none"],
                })
                return astncore.createStackedParser(
                    astncore.createDatasetDeserializer(
                        contextSchema.schema,
                        handler.root,
                        (error, annotation, severity) => onError(["deserialize", error], annotation.range, severity),
                        () => p.value(null),
                    ),
                    error => {
                        onError(["stacked", error.type], error.annotation.range, astncore.DiagnosticSeverity.error)
                    },
                    () => {
                        handler.onEnd({})
                        return p.value(null)
                    },
                    () => astncore.createDummyValueHandler(() => p.value(null))
                )
            } else if (embeddedSchemaSpecificationStart !== null) {
                if (internalSchema === null) {
                    if (!foundSchemaErrors) {
                        console.error("NO SCHEMA AND NO ERROR")
                    }
                    return dummyStackParser
                } else {
                    const handler = handlerBuilder(internalSchema)
                    return astncore.createStackedParser(
                        astncore.createDatasetDeserializer(
                            internalSchema.schemaAndSideEffects.schema,
                            handler.root,
                            (error, annotation, severity) => onError(["deserialize", error], annotation.range, severity),
                            () => p.value(null),
                        ),
                        error => {
                            onError(["stacked", error.type], error.annotation.range, astncore.DiagnosticSeverity.error)
                        },
                        () => {
                            handler.onEnd({})
                            return p.value(null)
                        },
                        () => astncore.createDummyValueHandler(() => p.value(null))
                    )
                }
            } else {
                onError(
                    ["no valid schema"],
                    firstBodyTokenAnnotation.range,
                    DiagnosticSeverity.error,
                )
                return dummyStackParser
            }

        },
        errorStreams: {
            onTreeParserError: $ => {
                onError(["tree", $.error], $.annotation.range, astncore.DiagnosticSeverity.error)
            },
            onTextParserError: $ => {
                onError(["structure", $.error], $.annotation.range, astncore.DiagnosticSeverity.error)
            },
            onTokenizerError: $ => {
                onError(["tokenizer", $.error], $.range, astncore.DiagnosticSeverity.error)
            },
        },
    })
    return parserStack
}
