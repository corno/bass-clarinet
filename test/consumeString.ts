import * as p from "pareto"
import * as p20 from "pareto-20"

export function consumeString<ReturnType>(
    dataIn: string,
    streamConsumer: p.IStreamConsumer<string, null, ReturnType>,
): p.IValue<ReturnType> {
    return p20.createArray([dataIn]).streamify().consume(
        null,
        streamConsumer,
    )
}

export function tryToConsumeString(
    dataIn: string,
    streamConsumer: p.IStreamConsumer<string, null, null>,
): p.IValue<null> {
    return p20.createArray([dataIn]).streamify().consume(
        null,
        streamConsumer,
    )
}