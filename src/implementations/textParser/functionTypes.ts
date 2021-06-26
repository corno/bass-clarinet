
export type TextErrorType =
    | ["expected the schema start (!) or root value"]
    | ["expected the schema"]
    | ["expected rootvalue"]
    | ["unexpected data after end", {
        data: string
    }]
