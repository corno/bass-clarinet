import * as p from "pareto"
import { Token } from "./ITreeParser"

export interface TokenConsumer<Annotation> {
    onData(token: Token<Annotation>): p.IValue<boolean>
    onEnd(aborted: boolean, annotation: Annotation): p.IValue<null>
}
