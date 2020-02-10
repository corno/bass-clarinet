import { Options } from "../src/configurationTypes"

export type EventDefinition = [string, string | undefined | false | true | null | number, number?, number?]

export type TestDefinition = {
    text: string,
    chunks?: string[],
    options?: Options
    events: EventDefinition[]
}

export type TestDefinitions = {
    [key: string]: TestDefinition
}