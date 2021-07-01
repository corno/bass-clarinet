import { InternalSchemaSpecification } from "./Dataset";
import { SchemaAndSideEffects } from "./SchemaAndSideEffects";

export type ResolvedSchema<TokenizerAnnotationData> = {
    specification: InternalSchemaSpecification
    schemaAndSideEffects: SchemaAndSideEffects<TokenizerAnnotationData>
}