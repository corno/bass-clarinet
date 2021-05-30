export type TestRange = [number?, number?, number?, number?]
export type TestLocation = [number?, number?]

export type EventDefinition =
    | ["token", "wrappedstring", string, TestRange  | null]
    | ["token", "nonwrappedstring", string, TestRange  | null]
    | ["token", "openarray", string | null, TestRange  | null]
    | ["token", "closearray", string | null, TestRange  | null]
    | ["token", "openobject", string | null, TestRange  | null]
    | ["token", "closeobject", string | null, TestRange | null]
    | ["token", "opentaggedunion", TestRange | null]
    | ["token", "linecomment", string, TestRange | null]
    | ["token", "blockcomment", string, TestRange | null]
    | ["parsingerror", string]
    | ["token", "schema data start", TestRange?]
    | ["end", TestLocation  | null]
    | ["instance data start"]
    | ["validationerror", string]
    | ["stacked error", string]
// [AnyEvent, string?, number?, number?]

export type TestDefinition = {
    readonly skipRoundTripCheck?: boolean
    readonly text: string
    readonly testHeaders?: boolean
    readonly testForLocation?: boolean
    readonly chunks?: string[]
    readonly events?: EventDefinition[]
    readonly formattedText?: string
}

export type TestDefinitions = {
    readonly [key: string]: TestDefinition
}

export type AnyEvent =
    | "validationerror"
    | "end"
    | "error"
    | HeaderEvent
    | DataEvent

export type HeaderEvent =
    | "schema data start"
    | "instance data start"

export type DataEvent =

    | "blockcomment"
    | "linecomment"

    | "number"
    | "wrappedstring"
    | "nonwrappedstring"

    | "opentaggedunion"
    | "closetaggedunion"
    | "option"

    | "openobject"
    | "closeobject"
    | "key"

    | "openarray"
    | "closearray"

    | "ready"
