/* eslint
    "max-classes-per-file": off,
*/

import * as astncore from "astn-core"
import { StructureErrorType, TokenError, TreeParserError } from "../../implementations"
import { SchemaDeserializationError } from "./SchemaDerializationErrors"

export type ReferencedSchemaResolvingError =
    | ["errors in referenced schema"]
    | ["loading", {
        message: string
    }]

export type DeserializationDiagnosticType =
    | ["ignoring invalid embedded schema"]
    | ["ignoring invalid schema reference"]
    | ["validation", {
        message: string
    }]
    | ["stacked", astncore.StackedDataErrorType]
    | ["tokenizer", TokenError]
    | ["structure", StructureErrorType]
    | ["tree", TreeParserError]
    | ["embedded schema error", SchemaDeserializationError]
    | ["schema reference resolving", ReferencedSchemaResolvingError]


export type DeserializationDiagnostic = {
    type: DeserializationDiagnosticType
}
