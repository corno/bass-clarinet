/* eslint
    max-classes-per-file: "off",
*/
import { Range, printRange, Location, printLocation } from "./location";

export class RangeError extends Error {
    public readonly range: Range
    public readonly rangeLessMessage: string
    constructor(message: string, range: Range) {
        super(`${message} @ ${printRange(range)}`)
        this.rangeLessMessage = message
        this.range = range
    }
}

export class LocationError extends Error {
    public readonly location: Location
    public readonly locationLessMessage: string
    constructor(message: string, location: Location) {
        super(`${message} @ ${printLocation(location)}`)
        this.location = location
        this.locationLessMessage = message
    }
}