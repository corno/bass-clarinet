import { TokenizerAnnotationData } from "../TokenizerAnnotationData"
import { SchemaAndSideEffects } from "./SchemaAndSideEffects"

export type InternalSchemaSpecification =
    | ["embedded"]
    | ["reference", { name: string }]
    | ["none"]

export type SerializationStyle =
    | ["expanded", { omitPropertiesWithDefaultValues: boolean }]
    | ["compact"]

export type ContextSchema =
    | ["ignored"]
    | ["not available"]
    | ["has errors"]
    | ["available", SchemaAndSideEffects<TokenizerAnnotationData>]