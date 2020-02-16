import { TokenizerOptions, ParserOptions } from "../src/configurationTypes"

export type EventDefinition =
    | ["quotedstring", string, number?, number?]
    | ["unquotedstring", string, number?, number?]
    | ["openarray", (string | number)?, number?]
    | ["closearray", (string | number)?, number?]
    | ["openobject", (string | number)?, number?]
    | ["closeobject", (string | number)?, number?]
    | ["key", string]
    | ["opentaggedunion"]
    | ["option", string]
    | ["closetaggedunion"]
    | ["end", number?, number?]
    | ["ready", number?, number?]
    | ["linecomment", string]
    | ["blockcomment", string]
    | ["error"]
    | ["schemastart"]
    | ["schemaend"]
    | ["validationerror", string]
// [AnyEvent, string?, number?, number?]

export type TestDefinition = {
    readonly text: string
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
    | "schemastart"
    | "schemaend"

export type DataEvent =

    | "blockcomment"
    | "linecomment"

    | "number"
    | "quotedstring"
    | "unquotedstring"

    | "opentaggedunion"
    | "closetaggedunion"
    | "option"

    | "openobject"
    | "closeobject"
    | "key"

    | "openarray"
    | "closearray"

    | "ready"
