import { ExpectedToken, ExpectErrorValue, ExpectErrorValueType } from "../../interfaces/IExpectContext";

export type ExpectErrorHandler<TokenAnnotation> = ($: {
    issue: ExpectError
    annotation: TokenAnnotation
}) => void

export enum Severity {
    warning,
    error,
    nothing
}
export enum OnDuplicateEntry {
    ignore,
    overwrite
}

export type ExpectError =
    | ["array is not a list", {
        //
    }]
    | ["array is not a shorthand type", {
        //
    }]

    | ["object is not a verbose type", {
        //
    }]

    | ["object is not a dictionary", {
        //
    }]
    | ["invalid value type", {
        found: ExpectErrorValueType
        expected: ExpectErrorValue
    }]
    | ["invalid string", {
        found: string
        expected: ExpectErrorValue
    }]
    | ["expected token", {
        token: ExpectedToken
        found: string
    }]
    | ["duplicate entry", {
        key: string
    }]
    | ["duplicate property", {
        name: string
    }]
    | ["missing property", {
        name: string
    }]
    | ["unexpected property", {
        "found key": string
        "valid keys": string[]
    }]
    | ["not a valid number", {
        value: string
    }]
    | ["not a quoted string", {
    }]
    | ["superfluous element", {
    }]
    | ["elements missing", {
        names: string[]
    }]
    | ["unknown option", {
        "found": string
        "valid options": string[]
    }]