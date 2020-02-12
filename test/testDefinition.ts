import { Options } from "../src/configurationTypes"

export type EventDefinition = [AnyEvent, (string | false | true | null | number)?, number?, number?]

export type TestDefinition = {
    text: string,
    chunks?: string[],
    options?: Options
    events: EventDefinition[]
}

export type TestDefinitions = {
    [key: string]: TestDefinition
}

export type AnyEvent =
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

    | "simplevalue"

    | "opentaggedunion"
    | "closetaggedunion"
    | "option"

    | "openobject"
    | "closeobject"
    | "key"

    | "openarray"
    | "closearray"

    | "ready"
