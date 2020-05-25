
import { IStreamConsumer } from "./IStreamConsumer"
import { TokenData } from "./TokenData"
import { Location } from "./location"

export type ITokenStreamConsumer = IStreamConsumer<TokenData, Location>