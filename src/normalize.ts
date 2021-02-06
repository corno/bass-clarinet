/*eslint
    "max-classes-per-file": "off",
*/
import * as p from "pareto"
import * as bc from "."
import { printParsingError } from "."
import * as handlers from "./handlers"
import {
    SerializableValue,
    IInDictionary,
    IInArray,
    SerializableCommentData,
    SerializableProperty,
    SerializableComment,
} from "./Serializable"
import {
    serializeDocument,
} from "./serialize"


function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

type HandleValue = (value: SerializableValue) => void

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

function createRequiredValueNormalizer(
    handleValue: HandleValue,
    sortKeys: boolean
): bc.RequiredValueHandler {
    return {
        onValue: createValueNormalizer(handleValue, sortKeys),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function transformContextData(source: handlers.ContextData) {
    const commentData: SerializableCommentData = {
        before: {
            comments: new InArray(source.before.comments.map(cb => {
                return {
                    text: cb.text,
                    type: ["inline"],
                }
            })),
        },
        lineCommentAfter: source.lineCommentAfter === null ? null : source.lineCommentAfter.text,
    }
    return commentData
}

function createValueNormalizer(handleValue: HandleValue, sortKeys: boolean): bc.OnValue {
    return valueContextData => {
        return {
            array: (_beginRange, openData) => {
                const elements: SerializableValue[] = []
                return {
                    element: () => createValueNormalizer(
                        elementValue => {
                            elements.push(elementValue)
                        },
                        sortKeys,
                    ),
                    end: (_endRange, _closeData, contextData) => {
                        handleValue({
                            commentData: transformContextData(valueContextData),
                            type: ["array", {
                                commentData: transformContextData(contextData),
                                elements: new InArray(elements),
                                openCharacter: openData.openCharacter,
                            }],
                        })
                    },
                }

            },
            object: (_beginRange, openData) => {
                const properties: { [key: string]: SerializableProperty } = {}

                return {
                    property: (_keyRange, key, contextData) => {
                        return p.result(createRequiredValueNormalizer(
                            propertyValue => {
                                properties[key] = {
                                    commentData: transformContextData(contextData),
                                    value: propertyValue,
                                }
                            },
                            sortKeys,
                        ))
                    },
                    end: (_endRange, _closeData, contextData) => {
                        handleValue({
                            commentData: transformContextData(valueContextData),
                            type: ["object", {
                                commentData: transformContextData(contextData),
                                properties: new InDictionary(properties, sortKeys),
                                openCharacter: openData.openCharacter,
                            }],
                        })
                    },
                }
            },
            simpleValue: (_range, data) => {
                handleValue({
                    commentData: transformContextData(valueContextData),
                    type: ["simple value", {
                        quote: data.quote,
                        value: data.value,
                    }],
                })
                return p.result(false)
            },
            taggedUnion: () => {
                return {
                    option: (_range, option, contextData) => {
                        return createRequiredValueNormalizer(
                            tuData => {
                                handleValue({
                                    commentData: transformContextData(valueContextData),
                                    type: ["tagged union", {
                                        option: option,
                                        commentData: transformContextData(contextData),
                                        data: tuData,
                                    }],
                                })
                            },
                            sortKeys,
                        )
                    },
                    missingOption: () => {
                        //
                    },
                    end: () => {
                        //
                    },
                }
            },
        }
    }
}

function createNormalizer(
    handleValue: HandleValue,
    sortKeys: boolean,
): bc.ParserEventConsumer<null, null> {

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

    let schemaValue: null | SerializableValue = null
    let compact = false
    let root: null | SerializableValue = null
    const overheadComments: SerializableComment[] = []

    return bc.parseString(
        dataAsString,
        _range => {
            return createNormalizer(
                sv => {
                    schemaValue = sv
                },
                sortKeys,
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
                sortKeys,
            )
        },
        err => { console.error("error: ", printParsingError(err)) },
        overheadToken => {
            switch (overheadToken.type[0]) {
                case bc.OverheadTokenType.BlockComment: {
                    const $ = overheadToken.type[1]
                    overheadComments.push({
                        text: $.comment,
                    })
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
                    documentComments: new InArray(overheadComments),
                },
                `    `,
                true,
                `\r\n`,
            ))
            //we're only here for the side effects, so no need to handle the result (which is 'null' anyway)
        }
    )
}
