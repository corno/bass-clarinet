import * as bc from "../src"

export type TestRange = [number?, number?, number?, number?]
export type TestLocation = [number?, number?]

export type EventDefinition =
    | ["token", "quotedstring", string, TestRange?]
    | ["token", "unquotedtoken", string, TestRange?]
    | ["token", "openarray", string?, TestRange?]
    | ["token", "closearray", string?, TestRange?]
    | ["token", "openobject", string?, TestRange?]
    | ["token", "closeobject", string?, TestRange?]
    | ["token", "opentaggedunion", TestRange?]
    | ["token", "linecomment", string, TestRange?]
    | ["token", "blockcomment", string, TestRange?]
    | ["parsererror", string]
    | ["tokenizererror", string]
    | ["token", "headerstart", TestRange?]
    | ["token", "compact", TestRange?]
    | ["end", TestLocation?]
    | ["headerend"]
    | ["validationerror", string]
    | ["stacked error", string]
// [AnyEvent, string?, number?, number?]

export type TestDefinition = {
    readonly skipRoundTripCheck?: boolean
    readonly text: string
    readonly testHeaders?: boolean
    readonly testForLocation?: boolean
    readonly chunks?: string[]
    readonly tokenizerOptions?: bc.TokenizerOptions
    readonly events: EventDefinition[]
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
    | "headerstart"
    | "compact"
    | "headerend"

export type DataEvent =

    | "blockcomment"
    | "linecomment"

    | "number"
    | "quotedstring"
    | "unquotedtoken"

    | "opentaggedunion"
    | "closetaggedunion"
    | "option"

    | "openobject"
    | "closeobject"
    | "key"

    | "openarray"
    | "closearray"

    | "ready"
