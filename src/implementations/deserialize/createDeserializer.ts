/* eslint
    "max-classes-per-file": off,
*/

import * as p20 from "pareto-20"
import * as p from "pareto"
import * as astncore from "astn-core"


import { ContextSchema, InternalSchemaSpecification } from "../../interfaces/deserialize/Dataset"
import { SchemaAndSideEffects } from "../../interfaces/deserialize/SchemaAndSideEffects"

import { DeserializeError } from "../../interfaces/deserialize/Errors"
import { ResolveReferencedSchema } from "../../interfaces/deserialize/ResolveReferencedSchema"
import { SchemaSchemaBuilder } from "../../interfaces/deserialize"
import { DiagnosticSeverity } from "astn-core"
import { loadPossibleExternalSchema } from "./loadExternalSchema"
import { TokenizerAnnotationData } from "../../interfaces"
import { createParserStack } from "../parser"
import { Range } from "../../generic"

export type ResolvedSchema = {
    specification: InternalSchemaSpecification
    schemaAndSideEffects: SchemaAndSideEffects<TokenizerAnnotationData>
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
    contextSchema: ContextSchema,
    resolveReferencedSchema: ResolveReferencedSchema,
    onError: (diagnostic: DeserializeError, range: Range, severity: astncore.DiagnosticSeverity) => void,

    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<TokenizerAnnotationData> | null,
    handlerBuilder: (
        schemaSpec: ResolvedSchema,
    ) => astncore.RootHandler<TokenizerAnnotationData>,
): p20.IStreamConsumer<string, null, null> {

    let internalSchemaSpecificationStart: null | Range = null
    let foundSchemaErrors = false

    let internalSchema: ResolvedSchema | null = null


    const parserStack = createParserStack({
        onEmbeddedSchema: (schemaSchemaReference, firstTokenAnnotation) => {
            internalSchemaSpecificationStart = firstTokenAnnotation.range

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
            internalSchemaSpecificationStart = annotation.range

            return loadPossibleExternalSchema(
                resolveReferencedSchema(schemaReference.value),
                getSchemaSchemaBuilder,
                error => {
                    foundSchemaErrors = true
                    onError(
                        ["schema reference resolving", error],
                        annotation.range,
                        astncore.DiagnosticSeverity.error,
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
            const dummyStackParser = astncore.createStackedParser<TokenizerAnnotationData>(
                astncore.createDummyTreeHandler(() => p.value(null)),
                error => {
                    onError(["stacked", error.type], error.annotation.range, astncore.DiagnosticSeverity.error)
                },
                () => {
                    return p.value(null)
                },
                () => astncore.createDummyValueHandler(() => p.value(null))
            )
            if (contextSchema[0] === "available") {
                if (internalSchemaSpecificationStart !== null) {
                    onError(
                        ["found both internal and context schema. ignoring internal schema"],
                        internalSchemaSpecificationStart,
                        DiagnosticSeverity.warning
                    )
                }
                const handler = handlerBuilder({
                    schemaAndSideEffects: contextSchema[1],
                    specification: ["none"],
                })
                return astncore.createStackedParser(
                    astncore.createDatasetDeserializer(
                        contextSchema[1].schema,
                        handler,
                        (error, annotation, severity) => onError(["deserialize", error], annotation.range, severity),
                        () => p.value(null),
                    ),
                    error => {
                        onError(["stacked", error.type], error.annotation.range, astncore.DiagnosticSeverity.error)
                    },
                    () => {
                        return handler.onEnd({})
                    },
                    () => astncore.createDummyValueHandler(() => p.value(null))
                )
            } else if (internalSchemaSpecificationStart !== null) {
                if (internalSchema === null) {
                    if (!foundSchemaErrors) {
                        console.error("NO SCHEMA AND NO ERROR")
                    }
                    onError(
                        ["no valid schema"],
                        firstBodyTokenAnnotation.range,
                        DiagnosticSeverity.error,
                    )
                    return dummyStackParser
                } else {
                    const handler = handlerBuilder(internalSchema)
                    return astncore.createStackedParser(
                        astncore.createDatasetDeserializer(
                            internalSchema.schemaAndSideEffects.schema,
                            handler,
                            (error, annotation, severity) => onError(["deserialize", error], annotation.range, severity),
                            () => p.value(null),
                        ),
                        error => {
                            onError(["stacked", error.type], error.annotation.range, astncore.DiagnosticSeverity.error)
                        },
                        () => {
                            return handler.onEnd({})
                        },
                        () => astncore.createDummyValueHandler(() => p.value(null))
                    )
                }
            } else {
                if (contextSchema[0] === "has errors") {
                    onError(
                        ["no valid schema"],
                        firstBodyTokenAnnotation.range,
                        DiagnosticSeverity.error,
                    )
                } else {
                    onError(
                        ["no schema"],
                        firstBodyTokenAnnotation.range,
                        DiagnosticSeverity.error,
                    )
                }
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
