import * as astncore from "astn-core"
import * as p from "pareto"

export type InternalSchemaSpecification =
    | ["embedded"]
    | ["reference", { name: string }]
    | ["none"]

export type SerializationStyle =
    | ["expanded", { omitPropertiesWithDefaultValues: boolean }]
    | ["compact"]

export type IDataset = {
    readonly schema: astncore.Schema
    readonly root: astncore.Root
    readonly documentComments: astncore.Comments
    readonly rootComments: astncore.Comments
    serialize: (
        iss: InternalSchemaSpecification,
        style: SerializationStyle,
        writer: (str: string) => void,
    ) => p.IValue<null>
}

export type IDeserializedDataset = {
    internalSchemaSpecification: InternalSchemaSpecification
    dataset: IDataset
}