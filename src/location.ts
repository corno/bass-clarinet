
export type Location = {
    readonly position: number
    readonly line: number
    readonly column: number
}

export type Range = {
    readonly start: Location
    readonly length: number
    readonly size: RangeSize
}

export type RangeSize =
    | ["single line", {
        "column offset": number
    }]
    | ["multi line", {
        "line offset": number
        "column": number
    }]

export function printLocation(location: Location): string {
    return `${location.line}:${location.column}`
}

export function printRange(range: Range): string {
    const tail = range.size[0] === "single line" ? `${range.start.column + range.size[1]["column offset"]}`  : `${range.size[1]["line offset"] + range.start.line}:${range.size[1].column}`
    return `${range.start.line}:${range.start.column}-${tail}`
}

export function getEndLocationFromRange(range: Range): Location {
    return {
        position: range.start.position + range.length,
        line: range.start.line,
        column: range.size[0] === "single line" ? range.size[1]["column offset"] + range.start.column : range.size[1].column,
    }
}


export function createRangeFromSingleLocation(location: Location): Range {
    return {
        start: location,
        length: 0,
        size: ["single line", { "column offset": 0 }],
    }
}

export function createRangeFromLocations(start: Location, end: Location): Range {
    return {
        start: start,
        length: end.position - start.position,
        size: ((): RangeSize => {
            if (start.line === end.line) {
                return ["single line", { "column offset": end.column - start.column }]
            } else {
                return ["multi line", { "line offset": end.line - start.line, "column": end.column }]
            }
        })(),
    }
}