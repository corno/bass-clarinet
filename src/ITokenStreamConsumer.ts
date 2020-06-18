
import * as p from "pareto"
import { PreToken } from "./PreToken"
import { Location } from "./location"

export type ITokenStreamConsumer<ReturnType, ErrorType> = p.IStreamConsumer<PreToken, Location, ReturnType, ErrorType>