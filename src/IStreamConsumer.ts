import * as p from "pareto"

export type OnDataReturnValue = p.DataOrPromise<boolean>

export interface IStreamConsumer<DataType, EndDataType> {
    onData(data: DataType): OnDataReturnValue
    onEnd(aborted: boolean, data: EndDataType): void
}