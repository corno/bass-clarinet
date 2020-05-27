
import * as p from "pareto"
import { TokenData } from "./TokenData"
import { Location } from "./location"

export type ITokenStreamConsumer = p.IStreamConsumer<TokenData, Location>