import * as p from "pareto"
import * as p20 from "pareto-20"

export function createStreamSplitter<DataType, EndDataType>(
    subStreamConsumers: p.IStreamConsumer<DataType, EndDataType, null, null>[]
): p.IStreamConsumer<DataType, EndDataType, null, null> {
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
            return p20.createArray(promises).mergeSafeValues(x => x).mapResult(abortResquests => {
                return p.result(abortRequested || abortResquests.includes(true)) //if 1 promise requested an abort
            })
        },
        onEnd: (aborted: boolean, endData: EndDataType): p.IUnsafeValue<null, null> => {
            return p20.createArray(
                subStreamConsumers
            ).mergeUnsafeValues(v => v.onEnd(aborted, endData)
            ).mapError(() => {
                return p.result(null)
            }).mapResult(() => {
                return p.result(null)
            })
        },
    }
}