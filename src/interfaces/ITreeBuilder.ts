import * as p from "pareto"


export type TreeBuilderStringValueDataType =
    | ["nonwrapped", {
        value: string
    }]
    | ["multiline", {
        lines: string[]
    }]
    | ["quoted", {
        value: string
    }]

export type TreeBuilderStringValueData = {
    type: TreeBuilderStringValueDataType
}

export type TreeBuilderObjectData = {
    type:
    | ["verbose type"]
    | ["dictionary"]
}

export type TreeBuilderArrayData = {
    type:
    | ["shorthand type"]
    | ["list"]
}

export type TreeBuilderEvent<Annotation> = {
    annotation: Annotation
    type:
    | ["close array"]
    | ["close object"]
    | ["open array", TreeBuilderArrayData]
    | ["open object", TreeBuilderObjectData]
    | ["string value", TreeBuilderStringValueData]
    | ["identifier", {
        name: string
    }]
    | ["tagged union", {
        //
    }]
}


/**
 * a TextParserEventConsumer is a IStreamConsumer.
 * the chunks are the individual TreeEvent's.
 * at the end, the location of the last character is sent ('Location').
 * The ReturnType and ErrorType are determined by the specific implementation.
 */
export type ITreeBuilder<Annotation, ReturnType, ErrorType> = p.IUnsafeStreamConsumer<TreeBuilderEvent<Annotation>, Annotation, ReturnType, ErrorType>