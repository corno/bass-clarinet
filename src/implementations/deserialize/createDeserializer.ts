/* eslint
    "max-classes-per-file": off,
*/

import * as p20 from "pareto-20"
import * as p from "pareto"
import * as astncore from "astn-core"
import * as astn from "../.."


import { InternalSchemaSpecification } from "../../interfaces/deserialize/Dataset"
import { SchemaAndSideEffects } from "../../interfaces/deserialize/SchemaAndSideEffects"

import { ReferencedSchemaDeserializationError } from "../../interfaces/deserialize/ReferencedSchemaDeserializationError"
import { DeserializationDiagnostic, DeserializationDiagnosticType } from "../../interfaces/deserialize/DeserializationDiagnostic"
import { IDeserializedDataset } from "../../interfaces/deserialize/Dataset"
import { IDataset } from "../../interfaces/deserialize/Dataset"
import { ResolveReferencedSchema } from "../../interfaces/deserialize/ResolveReferencedSchema"
import { SchemaSchemaBuilder } from "../../interfaces/deserialize"
import { createSchemaDeserializer } from "./createSchemaDeserializer"
import { ReferencedSchemaResolvingError } from "../../interfaces/deserialize"


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
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
    resolveReferencedSchema: ResolveReferencedSchema,
    onEmbeddedSchema: (
        specification: InternalSchemaSpecification,
        schemaAndSideEffects: SchemaAndSideEffects<astn.TokenizerAnnotationData>,
    ) => IDeserializedDataset,
    onNoEmbeddedSchema: () => IDataset | null,
    onError: (diagnostic: DeserializationDiagnostic, range: astn.Range, severity: astncore.DiagnosticSeverity) => void,
    sideEffectsHandlers: astncore.RootHandler<astn.TokenizerAnnotationData>[],
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<astn.TokenizerAnnotationData> | null,
): p20.IUnsafeStreamConsumer<string, null, IDeserializedDataset, ReferencedSchemaDeserializationError> {

    /*
    CSCH: I think it is better to not have the 2 callbacks: onEmbeddedSchema and onNoEmbeddedSchema,
    both their behaviour depends on the referenced schema.
    just add a 'referencedSchema' parameter and then handle the logic in this function.
    */

    function createDiagnostic(type: DeserializationDiagnosticType): DeserializationDiagnostic {
        return {
            type: type,
        }
    }

    let embeddedSchemaSpecificationStart: null | astn.Range = null
    let foundSchemaErrors = false

    type InternalSchema = {
        specification: InternalSchemaSpecification
        schemaAndSideEffects: SchemaAndSideEffects<astn.TokenizerAnnotationData>
    }

    let internalSchema: InternalSchema | null = null


    const parserStack = astn.createParserStack<IDeserializedDataset, ReferencedSchemaDeserializationError>({
        onEmbeddedSchema: (schemaSchemaReference, firstTokenAnnotation) => {
            embeddedSchemaSpecificationStart = firstTokenAnnotation.range

            const schemaSchemaBuilder = getSchemaSchemaBuilder(schemaSchemaReference)

            if (schemaSchemaBuilder === null) {
                throw new Error(`IMPLEMENT ME: unknown schema schema: ${schemaSchemaReference}`)
            }
            const builder = schemaSchemaBuilder(
                (error, annotation) => {
                    onError(createDiagnostic(["embedded schema error", error]), annotation.range, astncore.DiagnosticSeverity.error)
                    foundSchemaErrors = true
                }
            )
            return {
                onData: data => builder.onData(data),
                onEnd: (aborted, data) => {
                    return builder.onEnd(aborted, data).mapResult(schemaAndSideEffects => {
                        internalSchema = {
                            schemaAndSideEffects: schemaAndSideEffects,
                            specification: ["embedded"],
                        }
                        return p.value(null)
                    })
                },
            }
        },
        onSchemaReference: (schemaReference, annotation) => {
            return resolveReferencedSchema(schemaReference.value).mapError<ReferencedSchemaResolvingError>(error => {
                switch (error[0]) {
                    case "not found": {
                        return p.value(["loading", { message: `schema not found` }])
                    }
                    case "other": {
                        const $ = error[1]

                        return p.value(["loading", { message: `other: ${$.description}` }])
                    }
                    default:
                        return assertUnreachable(error[0])
                }
            }).try(
                stream => {
                    //console.log("FROM URL")
                    const schemaTok = createSchemaDeserializer(
                        message => {
                            //do nothing with errors
                            console.error("SCHEMA ERROR", message)
                        },
                        getSchemaSchemaBuilder,
                    )

                    return stream.tryToConsume<SchemaAndSideEffects<astn.TokenizerAnnotationData>, null>(
                        null,
                        schemaTok,
                    ).mapError(
                        () => {
                            //const myUrl = new URL(encodeURI(reference), pathStart)
                            return p.value(["errors in referenced schema"])
                        },
                    )
                },
            ).reworkAndCatch(
                error => {
                    foundSchemaErrors = true
                    onError(
                        createDiagnostic(
                            ["schema reference resolving", error],
                        ),
                        annotation.range,
                        astncore.DiagnosticSeverity.warning,
                    )
                    onError(
                        createDiagnostic(
                            ["ignoring invalid schema reference"],
                        ),
                        annotation.range,
                        astncore.DiagnosticSeverity.warning,
                    )
                    return p.value(null)
                },
                schemaAndSideEffects => {
                    internalSchema = {
                        schemaAndSideEffects: schemaAndSideEffects,
                        specification: ["reference", { name: schemaReference.value }],
                    }
                    return p.value(null)
                },
            )
        },
        onBody: (): astncore.ITreeBuilder<astn.TokenizerAnnotationData, IDeserializedDataset, ReferencedSchemaDeserializationError> => {
            if (embeddedSchemaSpecificationStart !== null && internalSchema === null) {
                if (!foundSchemaErrors) {
                    console.error("NO SCHEMA AND NO ERROR")
                    //throw new Error("Unexpected: no schema errors and no schema")
                }
            }

            const dataset: IDeserializedDataset | null = (internalSchema === null)
                ? ((): IDeserializedDataset | null => { //no internal schema
                    const ds = onNoEmbeddedSchema()
                    if (ds === null) {
                        return null
                    }
                    return {
                        dataset: ds,
                        internalSchemaSpecification: ["none"],
                    }
                })()
                : onEmbeddedSchema(internalSchema.specification, internalSchema.schemaAndSideEffects) //internal schema

            if (dataset === null) {
                return {
                    onData: () => {
                        //
                        return p.value(false)
                    },
                    onEnd: () => {
                        return p.error({
                            problem: "no valid schema",
                        })
                    },
                }
            }
            return astncore.createStackedParser(
                astncore.createDatasetDeserializer(
                    dataset.dataset.schema,
                    dataset.dataset.root,
                    dataset.dataset.rootComments,
                    sideEffectsHandlers.map(h => h.root),
                    (message, annotation, severity) => onError(createDiagnostic(["validation", { message: message }]), annotation.range, severity),
                    () => p.value(null),
                ),
                error => {
                    onError(createDiagnostic(["stacked", error.type]), error.annotation.range, astncore.DiagnosticSeverity.error)
                },
                () => {
                    sideEffectsHandlers.forEach(h => {
                        h.onEnd({})
                    })
                    return p.success(dataset)
                },
                () => astncore.createDummyValueHandler(() => p.value(null))
            )
        },
        errorStreams: {
            onTreeParserError: $ => {
                onError(createDiagnostic(["tree", $.error]), $.annotation.range, astncore.DiagnosticSeverity.error)
            },
            onTextParserError: $ => {
                onError(createDiagnostic(["structure", $.error]), $.annotation.range, astncore.DiagnosticSeverity.error)
            },
            onTokenizerError: $ => {
                onError(createDiagnostic(["tokenizer", $.error]), $.range, astncore.DiagnosticSeverity.error)
            },
        },
    })
    return parserStack
}
