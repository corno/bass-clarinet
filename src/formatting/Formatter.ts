import { TokenFormatInstruction, NonTokenFormatInstruction } from "./FormatInstruction"
import { Annotater } from "../interfaces/IAnnotater"

export type Formatter<TokenAnnotation, NonTokenAnnotation> = {
    onSchemaHeader: () => string
    onAfterSchema: () => string
    schemaFormatter: Annotater<TokenAnnotation, NonTokenAnnotation, TokenFormatInstruction, NonTokenFormatInstruction>
    bodyFormatter: Annotater<TokenAnnotation, NonTokenAnnotation, TokenFormatInstruction, NonTokenFormatInstruction>
}