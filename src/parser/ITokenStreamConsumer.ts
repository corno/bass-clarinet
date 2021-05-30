
import * as p from "pareto"
import { Location } from "../location"
import { PreToken } from "../pretokenizer"

export type ITokenStreamConsumer<ReturnType, ErrorType> = p.IUnsafeStreamConsumer<PreToken, Location, ReturnType, ErrorType>