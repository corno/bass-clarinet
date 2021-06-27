import { InternalSchemaDeserializationError } from "."
import { StructureErrorType, TokenError, TreeParserError } from "../../implementations"
import { EmbeddedSchemaError } from "./SchemaDerializationErrors"

export type SchemaSchemaError =
    | ["internal schema", EmbeddedSchemaError]
    | ["unknown schema schema", {
        name: string
    }]
    | ["missing schema schema definition"]
    | ["tokenizer", TokenError]
    | ["structure", StructureErrorType]
    | ["tree", TreeParserError]
    | ["schema processing", InternalSchemaDeserializationError]

