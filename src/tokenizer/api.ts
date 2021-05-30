import * as p from "pareto"
import { Location } from "../location"
import { Token } from "../treeParser"

export interface TokenConsumer<ReturnType, ErrorType> {
    onData(token: Token): p.IValue<boolean>
    onEnd(aborted: boolean, location: Location): p.IUnsafeValue<ReturnType, ErrorType>
}
