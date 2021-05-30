
export type StackedDataError =
| ["unexpected end of document", {
    "still in":
    | ["array"]
    | ["object"]
    | ["tagged union"]
}]
| ["missing property data"]
| ["unmatched dictionary close"]
| ["unmatched verbose type close"]

| ["unmatched list close"]
| ["unmatched shorthand type close"]
| ["missing object close"]
| ["missing array close"]
| ["missing tagged union value"]
| ["missing tagged union option and value"]
| ["unexpected end of array"]
| ["unexpected end of object"]
| ["unexpected key"]