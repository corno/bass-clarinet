import { TokenizerOptions, ParserOptions } from "../src/configurationTypes"

export type TestRange = [number?, number?, number?, number?]
export type TestLocation = [number?, number?]

export type EventDefinition =
    | ["quotedstring", string, TestRange?]
    | ["unquotedtoken", string, TestRange?]
    | ["openarray", string?, TestRange?]
    | ["closearray", string?, TestRange?]
    | ["openobject", string?, TestRange?]
    | ["closeobject", string?, TestRange?]
    | ["key", string]
    | ["opentaggedunion"]
    | ["option", string]
    | ["closetaggedunion"]
    | ["end", TestLocation?]
    | ["ready"]
    | ["linecomment", string, TestRange?]
    | ["blockcomment", string, TestRange?]
    | ["parsererror", string]
    | ["tokenizererror", string]
    | ["headerstart"]
    | ["compact"]
    | ["headerend"]
    | ["validationerror", string]
// [AnyEvent, string?, number?, number?]

export type TestDefinition = {
    readonly skipEqualityCheck?: boolean
    readonly text: string
    readonly testHeaders?: boolean
    readonly chunks?: string[]
    readonly parserOptions?: ParserOptions
    readonly tokenizerOptions?: TokenizerOptions
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
