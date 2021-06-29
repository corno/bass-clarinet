import { SchemaAndSideEffects } from "./SchemaAndSideEffects"
import * as astncore from "astn-core"
import { SchemaDeserializationError } from "./Errors"

export type SchemaSchemaBuilder<Annotation> = (
    onSchemaError: (error: SchemaDeserializationError, annotation: Annotation) => void,
    onSchema: (schema: SchemaAndSideEffects<Annotation>) => void,
) => astncore.ITreeBuilder<Annotation>
