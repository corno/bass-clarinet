/* eslint
    max-classes-per-file: "off",
*/
import { Range, printRange } from "./parser/location";

/**
 * a RangeError has a range of characters to which it applies
 */
export class RangeError extends Error {
    public readonly range: Range
    /**
     * as a RangeError extends a regular Error, it will have a message. In this message there will be range information
     * If you need a message without the range information, use this property
     */
    public readonly rangeLessMessage: string
    constructor(message: string, range: Range) {
        super(`${message} @ ${printRange(range)}`)
        this.rangeLessMessage = message
        this.range = range
    }
}