
export type Location = {
    readonly position: number,
    readonly line: number,
    readonly column: number,
}

export type Range = {
    start: Location
    end: Location
}

export function printLocation(location: Location) {
    return `${location.line}:${location.column}`
}

export function printRange(range: Range) {
    return `${range.start.line}:${range.start.column}-${range.start.line === range.end.line ? "" : range.end.line + ":"}${range.end.column}`
}