import * as astncore from "astn-core"

/**
 * a schema implementation should provide this type
 */
export type SchemaAndSideEffects<Annotation, ReturnType> = {
    schema: astncore.Schema
    createStreamingValidator: (
        onValidationError: (message: string, annotation: Annotation, severity: astncore.DiagnosticSeverity) => void,
    ) => astncore.RootHandler<Annotation, ReturnType>
    //createAsyncValidator: () => buildAPI.Root
}