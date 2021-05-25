import * as p from "pareto"
import { TreeEvent } from "./TreeEvent";
import { Location } from "./location"

/**
 * a TextParserEventConsumer is a IStreamConsumer.
 * the chunks are the individual TreeEvent's.
 * at the end, the location of the last character is sent ('Location').
 * The ReturnType and ErrorType are determined by the specific implementation.
 */
 export type TextParserEventConsumer<ReturnType, ErrorType> = p.IUnsafeStreamConsumer<TreeEvent, Location, ReturnType, ErrorType>