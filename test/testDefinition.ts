import { Options } from "../src/configurationTypes"

export type EventDefinition = [AnyEvent, (string | false | true | null | number)?, number?, number?]

export type TestDefinition = {
    readonly text: string
    readonly chunks?: string[]
    readonly options?: Options
    readonly events: EventDefinition[]
}

export type TestDefinitions = {
    readonly [key: string]: TestDefinition
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
