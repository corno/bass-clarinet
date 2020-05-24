import * as p from "pareto"

export type OnDataReturnValue = boolean | p.ISafePromise<boolean>

export interface IStreamConsumer<DataType, EndDataType> {
    onData(data: DataType): OnDataReturnValue
    onEnd(aborted: boolean, data: EndDataType): void
}