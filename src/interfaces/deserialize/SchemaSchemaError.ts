import { SchemaDeserializationError } from "."
import { StructureErrorType, TokenError, TreeParserError } from "../../implementations"

export type SchemaError =
    | ["schema schema cannot be embedded"]
    | ["unknown schema schema", {
        name: string
    }]
    | ["missing schema schema definition"]
    | ["tokenizer", TokenError]
    | ["structure", StructureErrorType]
    | ["tree", TreeParserError]
    | ["schema processing", SchemaDeserializationError]

