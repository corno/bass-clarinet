import * as p from "pareto"
import * as path from "path"
import * as astncore from "astn-core"
import { ContextSchemaError, SchemaAndSideEffects, SchemaSchemaBuilder, TokenizerAnnotationData } from "../../interfaces"
import { RetrievalError } from "../../interfaces/deserialize/ResolveReferencedSchema"
import { loadExternalSchema } from "./loadExternalSchema"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export type ContextSchemaData = {
    filePath: string
    getContextSchema: (dir: string, schemaFileName: string) => p.IUnsafeValue<p.IStream<string, null>, RetrievalError>
}

export const schemaFileName = "schema.astn-schema"

export type ContextSchema =
    | ["ignored"]
    | ["not available"]
    | ["has errors"]
    | ["available", SchemaAndSideEffects<TokenizerAnnotationData>]


export function loadContextSchema(
    data: ContextSchemaData,
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<TokenizerAnnotationData> | null,
    onError: (error: ContextSchemaError, severity: astncore.DiagnosticSeverity) => void,
): p.IValue<ContextSchema> {
    const basename = path.basename(data.filePath)
    const dir = path.dirname(data.filePath)
    if (basename === schemaFileName) {
        //don't validate the schema against itself
        onError(["validating schema file against internal schema"], astncore.DiagnosticSeverity.warning)
        return p.value(["ignored"])
    }

    return data.getContextSchema(
        dir,
        schemaFileName,
    ).mapError<ContextSchema>(error => {
        switch (error[0]) {
            case "not found": {
                //this is okay, the context schema is optional
                return p.value(["not available"])
            }
            case "other": {
                const $ = error[1]
                onError(["external schema resolving", ["loading", {
                    message: `other: ${$.description}`,
                }]], astncore.DiagnosticSeverity.error)
                return p.value(["has errors"])
            }
            default:
                return assertUnreachable(error[0])
        }
    }).try<ContextSchema>(
        stream => {
            return loadExternalSchema(
                stream,
                getSchemaSchemaBuilder,
                error => {
                    onError(["external schema resolving", error], astncore.DiagnosticSeverity.error)
                },
            ).reworkAndCatch<ContextSchema>(
                _error => {
                    return p.value(["has errors"])
                },
                schema => {
                    return p.value(["available", schema])
                }
            )
        }
    ).catch(error => {
        return p.value(error)
    })
    // return loadExternalSchema(
    //     ,
    //     getSchemaSchemaBuilder,
    //     error => {
    //         onError(["external schema resolving", error], astncore.DiagnosticSeverity.error)
    //     },
    // )
}