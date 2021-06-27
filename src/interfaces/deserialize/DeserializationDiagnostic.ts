/* eslint
    "max-classes-per-file": off,
*/

import * as astncore from "astn-core"
import { StructureErrorType, TokenError, TreeParserError } from "../../implementations"
import { InternalSchemaDeserializationError } from "./SchemaDerializationErrors"

export type DeserializationDiagnosticType =
    | ["ignoring invalid embedded schema"]
    | ["ignoring invalid schema reference"]
    | ["deserializer", {
        message: string
    }]
    | ["stacked", astncore.StackedDataErrorType]
    | ["tokenizer", TokenError]
    | ["structure", StructureErrorType]
    | ["tree", TreeParserError]
    | ["schema error", InternalSchemaDeserializationError]

export type DeserializationDiagnostic = {
    type: DeserializationDiagnosticType
}
