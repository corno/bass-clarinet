import * as p from "pareto"
import * as path from "path"
import * as astncore from "astn-core"
import { ContextSchemaError, SchemaAndSideEffects, SchemaSchemaBuilder, TokenizerAnnotationData } from "../../interfaces"
import { RetrievalError } from "../../interfaces/deserialize/ResolveReferencedSchema"
import { loadExternalSchema } from "./loadExternalSchema"

export type ContextSchemaData = {
    filePath: string
    getContextSchema: (dir: string, schemaFileName: string) => p.IUnsafeValue<p.IStream<string, null>, RetrievalError>
}

export const schemaFileName = "schema.astn-schema"

export function loadContextSchema(
    data: ContextSchemaData,
    getSchemaSchemaBuilder: (
        name: string,
    ) => SchemaSchemaBuilder<TokenizerAnnotationData> | null,
    onError: (error: ContextSchemaError, severity: astncore.DiagnosticSeverity) => void,
    onSchema: (
        schema: SchemaAndSideEffects<TokenizerAnnotationData>
    ) => void
): p.IValue<null> {
    const basename = path.basename(data.filePath)
    const dir = path.dirname(data.filePath)
    if (basename === schemaFileName) {
        //don't validate the schema against itself
        onError(["validating schema file against internal schema"], astncore.DiagnosticSeverity.warning)
        return p.value(null)
    }

    return loadExternalSchema(
        data.getContextSchema(
            dir,
            schemaFileName,
        ),
        getSchemaSchemaBuilder,
        error => {
            onError(["external schema resolving", error], astncore.DiagnosticSeverity.error)
        },
        onSchema,
    )
}