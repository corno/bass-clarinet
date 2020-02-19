/* eslint
    max-classes-per-file: "off",
*/
import { Range, printRange, Location, printLocation } from "./location";

export class RangeError extends Error {
    constructor(message: string, range: Range) {
        super(`${message} @ ${printRange(range)}`)
    }
}

export class LocationError extends Error {
    constructor(message: string, location: Location) {
        super(`${message} @ ${printLocation(location)}`)
    }
}