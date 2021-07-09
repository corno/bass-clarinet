import { SchemaAndSideEffects } from "./SchemaAndSideEffects"

export type InternalSchemaSpecification =
    | ["embedded"]
    | ["reference", { name: string }]
    | ["none"]

export type SerializationStyle =
    | ["expanded", { omitPropertiesWithDefaultValues: boolean }]
    | ["compact"]

export type ContextSchema<Annotation, ReturnType> =
    | ["ignored"]
    | ["not available"]
    | ["has errors"]
    | ["available", SchemaAndSideEffects<Annotation, ReturnType>]