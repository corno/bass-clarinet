import * as p from "pareto"
import { SchemaAndSideEffects } from "./SchemaAndSideEffects"
import * as astncore from "astn-core"
import { SchemaDeserializationError } from "./Errors"

export type SchemaSchemaBuilder<Annotation, ReturnType> = (
    onSchemaError: (error: SchemaDeserializationError, annotation: Annotation) => void,
    onSchema: (schema: SchemaAndSideEffects<Annotation, ReturnType>) => p.IValue<null>,
) => astncore.ITreeBuilder<Annotation>
