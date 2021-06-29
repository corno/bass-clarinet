
export type InternalSchemaSpecification =
    | ["embedded"]
    | ["reference", { name: string }]
    | ["none"]

export type SerializationStyle =
    | ["expanded", { omitPropertiesWithDefaultValues: boolean }]
    | ["compact"]
