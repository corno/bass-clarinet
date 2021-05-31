import { Annotater } from "../interfaces/IAnnotater"
import { NonTokenFormatInstruction, TokenFormatInstruction } from "./FormatInstruction"

export function createOmittingFormatter<TokenAnnotation, NonTokenAnnotation>(
): Annotater<TokenAnnotation, NonTokenAnnotation, TokenFormatInstruction, NonTokenFormatInstruction> {

    return {
        objectBegin: () => {
            return {
                stringBefore: ``,
                token: ``,
                stringAfter: ``,
            }
        },
        property: () => {
            return {
                stringBefore: ``,
                token: ``,
                stringAfter: ``,
            }
        },
        objectEnd: () => {
            return {
                stringBefore: ``,
                token: ``,
                stringAfter: ``,
            }
        },

        arrayBegin: () => {
            return {
                stringBefore: ``,
                token: ``,
                stringAfter: ``,
            }
        },
        element: () => {
            return {
                string: ``,
            }
        },
        arrayEnd: () => {
            return {
                stringBefore: ` `,
                token: ``,
                stringAfter: ``,
            }
        },

        stringValue: () => {
            return {
                stringBefore: ``,
                token: ``,
                stringAfter: ``,
            }
        },

        taggedUnionBegin: () => {
            return {
                stringBefore: ``,
                token: ``,
                stringAfter: ``,
            }
        },
        option: () => {
            return {
                stringBefore: ``,
                token: ``,
                stringAfter: ``,
            }
        },
        taggedUnionEnd: () => {
            return {
                string: ``,
            }
        },
    }
}

