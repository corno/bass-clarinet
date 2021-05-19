
import * as p from "pareto"
import { PreToken } from "./PreToken"
import { Location } from "./location"

export type ITokenStreamConsumer<ReturnType, ErrorType> = p.IUnsafeStreamConsumer<PreToken, Location, ReturnType, ErrorType>