/*eslint
    "max-classes-per-file": "off",
*/
import * as p from "pareto"
import * as bc from ".."
import { printParsingError } from ".."
import {
    Value,
    serializeDocument,
    IInDictionary,
    IInArray,
} from "./serialize"


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type HandleValue = (value: Value) => void

class InDictionary<T> implements IInDictionary<T> {
    private readonly properties: { [key: string]: T }
    private readonly sortKeys: boolean
    constructor(properties: { [key: string]: T }, sortKeys: boolean) {
        this.properties = properties
        this.sortKeys = sortKeys
    }
    isEmpty() {
        return Object.keys(this.properties).length === 0
    }
    map<R>(callback: (property: T, name: string) => R) {
        const keys = Object.keys(this.properties)
        const orderedKeys = this.sortKeys ? keys.sort() : keys
        return new InArray(orderedKeys.map(e => callback(this.properties[e], e)))
    }
}

class InArray<T> implements IInArray<T> {
    private readonly elements: T[]
    constructor(elements: T[]) {
        this.elements = elements
    }
    isEmpty() {
        return this.elements.length === 0
    }
    map<R>(callback: (element: T) => R) {
        return new InArray(this.elements.map(e => callback(e)))
    }

    forEach(callback: (element: T) => void) {
        this.elements.forEach(e => callback(e))
    }
}

function createRequiredValueNormalizer(handleValue: HandleValue, sortKeys: boolean): bc.RequiredValueHandler {
    return {
        onValue: createValueNormalizer(handleValue, sortKeys),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValueNormalizer(handleValue: HandleValue, sortKeys: boolean): bc.OnValue {
    return () => {
        return {
            array: (_beginRange, openData) => {
                const elements: Value[] = []
                return {
                    element: () => createValueNormalizer(
                        elementValue => {
                            elements.push(elementValue)
                        },
                        sortKeys,
                    ),
                    end: (_endRange, _closeData) => {
                        handleValue(["array", {
                            elements: elements,
                            openCharacter: openData.openCharacter,
                        }])
                    },
                }

            },
            object: (_beginRange, openData) => {
                const properties: { [key: string]: Value } = {}
                return {
                    property: (_keyRange, key) => {
                        return p.result(createRequiredValueNormalizer(
                            propertyValue => {
                                properties[key] = propertyValue
                            },
                            sortKeys,
                        ))
                    },
                    end: (_endRange, _closeData) => {
                        handleValue(["object", {
                            properties: new InDictionary(properties, sortKeys),
                            openCharacter: openData.openCharacter,
                        }])
                    },
                }
            },
            simpleValue: (_range, data) => {
                handleValue(["simple value", {
                    quote: data.quote,
                    value: data.value,
                }])
                return p.result(false)
            },
            taggedUnion: () => {
                return {
                    option: (_range, option) => {
                        return createRequiredValueNormalizer(
                            tuData => {
                                handleValue(["tagged union", {
                                    option: option,
                                    data: tuData,
                                }])
                            },
                            sortKeys,
                        )
                    },
                    missingOption: () => {
                        //
                    },
                }
            },
        }
    }
}

export function createNormalizer(handleValue: HandleValue, sortKeys: boolean): bc.ParserEventConsumer<null, null> {
    const datasubscriber = bc.createStackedDataSubscriber<null, null>(
        {
            onValue: createValueNormalizer(handleValue, sortKeys),
            onMissing: () => {
                console.error("FOUND MISSING DATA")

            },
        },
        error => {
            console.error("FOUND STACKED DATA ERROR", error)
        },
        () => {
            //onEnd
            //no need to return an value, we're only here for the side effects, so return 'null'
            return p.success(null)
        }
    )
    return datasubscriber
}

/**
 *
 * @param dataAsString
 * @param sortKeys this is a convenience parameter. if sorting is not required, normalizing can also be done in a streaming approach which requires less memory
 */
export function normalize(
    dataAsString: string,
    sortKeys: boolean,
): p.IUnsafeValue<p.IStream<string, null>, null> {

    let schemaValue: null | Value = null
    let compact = false
    let root: null | Value = null

    return bc.parseString(
        dataAsString,
        _range => {
            return createNormalizer(
                sv => {
                    schemaValue = sv
                },
                sortKeys
            )
        },
        compactRange => {
            if (compactRange !== null) {
                compact = true
            }
            return createNormalizer(
                iv => {
                    root = iv
                },
                sortKeys
            )
        },
        err => { console.error("error: ", printParsingError(err)) },
        overheadToken => {
            switch (overheadToken.type[0]) {
                case bc.OverheadTokenType.BlockComment: {
                    //const $ = data.type[1]

                    break
                }
                case bc.OverheadTokenType.LineComment: {
                    //const $ = data.type[1]

                    break
                }
                case bc.OverheadTokenType.NewLine: {
                    //const $ = data.type[1]

                    break
                }
                case bc.OverheadTokenType.WhiteSpace: {
                    //const $ = data.type[1]

                    break
                }
                default:
                    assertUnreachable(overheadToken.type[0])
            }
            return p.result(false)
        },
    ).mapResult(
        () => {
            if (root === null) {
                throw new Error("unexpected missing instance value")
            }
            return p.result(serializeDocument(
                {
                    schema: schemaValue,
                    compact: compact,
                    root: root,
                },
                `    `,
                true,
            ))
            //we're only here for the side effects, so no need to handle the result (which is 'null' anyway)
        }
    )
}
