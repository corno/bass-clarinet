import { SchemaAndSideEffects } from "./SchemaAndSideEffects"
import * as astncore from "astn-core"
import { SchemaDeserializationError } from "./SchemaDerializationErrors"

export type SchemaSchemaBuilder<Annotation> = (
    onSchemaError: (error: SchemaDeserializationError, annotation: Annotation) => void
) => astncore.ITreeBuilder<Annotation, SchemaAndSideEffects<Annotation>, null>