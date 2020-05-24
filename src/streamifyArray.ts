import * as p20 from "pareto-20"
import { IStreamConsumer } from "./IStreamConsumer"

export function streamifyArray<DataType, EndDataType>(
    array: DataType[],
    endData: EndDataType,
    limiter: p20.StreamLimiter,
    streamConsumer: IStreamConsumer<DataType, EndDataType>,
): void {
    const streamFunction = p20.streamifyArray(
        array,
        endData,
    )
    streamFunction(
        limiter,
        data => {
            return streamConsumer.onData(data)
        },
        (aborted, endData2) => {
            return streamConsumer.onEnd(aborted, endData2)
        }
    )
}