
export type StructureErrorType =
    | ["expected the schema start (!) or root value"]
    | ["expected a schema reference or a schema body"]
    | ["expected the schema"]
    | ["expected rootvalue"]
    | ["unexpected data after end", {
        data: string
    }]
