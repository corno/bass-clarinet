import { StringValueData } from "../interfaces/handlers"
import { createSerializedMultilineString, createSerializedNonWrappedString, createSerializedQuotedString } from "./escapeString"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function createSerializedString(
    data: StringValueData,
    indentation: string,
    newline: string,
): string {
    switch (data.type[0]) {
        case "multiline": {
            const $$ = data.type[1]
            return createSerializedMultilineString(
                $$.lines,
                indentation,
                newline,
            )
        }
        case "nonwrapped": {
            const $$ = data.type[1]
            return createSerializedNonWrappedString($$.value)
        }
        case "quoted": {
            const $$ = data.type[1]
            return createSerializedQuotedString($$.value)
        }
        default:
            return assertUnreachable(data.type[0])
    }
}