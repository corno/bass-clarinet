import * as p from "pareto"
import { Location } from "../generic/location"
import { Token } from "./ITreeParser"

export interface TokenConsumer<ReturnType, ErrorType> {
    onData(token: Token): p.IValue<boolean>
    onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType>
}
