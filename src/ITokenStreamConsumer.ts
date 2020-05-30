
import * as p from "pareto"
import { TokenData } from "./TokenData"
import { Location } from "./location"

export type ITokenStreamConsumer<ReturnType, ErrorType> = p.IStreamConsumer<TokenData, Location, ReturnType, ErrorType>