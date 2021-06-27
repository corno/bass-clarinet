import * as astncore from "astn-core"
import * as p from "pareto"

export enum InternalSchemaSpecificationType {
    Reference,
    None,
    Embedded
}

export type InternalSchemaSpecification =
| [InternalSchemaSpecificationType.Embedded]
| [InternalSchemaSpecificationType.Reference, { name: string }]
| [InternalSchemaSpecificationType.None]

export type SerializationStyle =
    | ["expanded", { omitPropertiesWithDefaultValues: boolean }]
    | ["compact"]

export interface IDataset2 {
    readonly schema: astncore.Schema
    readonly root: astncore.Node
    readonly documentComments: astncore.Comments
    readonly rootComments: astncore.Comments
}

export type IDataset = {
    build: IDataset2
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