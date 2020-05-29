import * as p from "pareto"

export function createStreamSplitter<DataType, EndDataType>(
    subStreamConsumers: p.IStreamConsumer<DataType, EndDataType>[]
): p.IStreamConsumer<DataType, EndDataType> {
    return {
        onData: (data: DataType): p.IValue<boolean> => {
            let abortRequested = false
            const promises: p.IValue<boolean>[] = []
            subStreamConsumers.forEach(s => {
                const returnValue = s.onData(data)
                if (returnValue instanceof Array) {
                    if (returnValue[0] === true) {
                        abortRequested = true
                    }
                } else {
                    promises.push(returnValue)
                }
            })
            if (promises.length === 0) {
                return p.result(abortRequested)
            }
            return p.mergeArrayOfSafeValues(promises).mapResult(abortResquests => {
                return p.result(abortRequested || abortResquests.includes(true)) //if 1 promise requested an abort
            })
        },
        onEnd: (aborted: boolean, endData: EndDataType): void => {
            subStreamConsumers.forEach(s => {
                s.onEnd(aborted, endData)
            })
        },
    }
}