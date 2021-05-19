/*eslint
    "max-classes-per-file": "off",
*/
import * as p from "pareto"
import * as astn from "."
import { printParsingError } from "."
import {
    SerializableValue,
    IInDictionary,
    IInArray,
    SerializableCommentData,
    SerializableProperty,
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
    sortKeys: boolean,
    comments: astn.Comment[]
): astn.RequiredValueHandler {
    return {
        onValue: createValueNormalizer(
            handleValue,
            sortKeys,
            comments,
        ),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function addComments(contextData: astn.ContextData, comments: astn.Comment[]) {
    contextData.before.comments.forEach(c => {
        comments.push(c)
    })
    if (contextData.lineCommentAfter !== null) {
        comments.push(contextData.lineCommentAfter)
    }
}

function transformCommentsToSerializableCommentData(comments: astn.Comment[]) {
    const commentData: SerializableCommentData = {
        before: {
            comments: new InArray(comments.map(cb => {
                return {
                    text: cb.text,
                }
            })),
        },
        lineCommentAfter: null,
    }
    return commentData
}

function createEmptyCommentsData() {
    const commentData: SerializableCommentData = {
        before: {
            comments: new InArray([]),
        },
        lineCommentAfter: null,
    }
    return commentData
}

/**
 *
 * @param handleValue
 * @param comments optional parameter. If specified, the comments found for the value will be added
 * to that array instead of to it's own array of comments. This is done for values of properties,
 * for the value of a tagged union and for the root value of the document, but not for values that
 * are elements of an array.
 * @param sortKeys
 */
function createValueNormalizer(
    handleValue: HandleValue,
    sortKeys: boolean,
    parentComments: astn.Comment[] | null,
): astn.OnValue {
    return valueContextData => {
        const valueComments: astn.Comment[] = []
        const comments = parentComments === null ? valueComments : parentComments
        addComments(valueContextData, comments)
        return {
            array: (_beginRange, openData) => {
                const isArrayType = openData.openCharacter === "<"
                const elements: SerializableValue[] = []
                return {
                    element: () => createValueNormalizer(
                        elementValue => {
                            elements.push(elementValue)
                        },
                        sortKeys,
                        null,
                    ),
                    end: (_endRange, _closeData, arrayEndContextData) => {
                        const intermediateComments: astn.Comment[] = []
                        addComments(arrayEndContextData, intermediateComments)
                        handleValue({
                            commentData: transformCommentsToSerializableCommentData(valueComments),
                            type: ["array", {
                                commentData: createEmptyCommentsData(),
                                elements: new InArray(elements),
                                openCharacter: isArrayType ? "<" : "[",
                                closeCharacter: isArrayType ? ">" : "]",
                            }],
                        })
                    },
                }

            },
            object: (_beginRange, openData) => {
                const properties: { [key: string]: SerializableProperty } = {}

                const isType = openData.openCharacter === "("
                return {
                    property: (_keyRange, key, contextData) => {
                        const propertyComments: astn.Comment[] = []
                        addComments(contextData, propertyComments)
                        return p.value(createRequiredValueNormalizer(
                            propertyValue => {
                                properties[key] = {
                                    quote: isType ? "'" : "\"",
                                    commentData: transformCommentsToSerializableCommentData(propertyComments),
                                    value: propertyValue,
                                }
                            },
                            sortKeys,
                            propertyComments,
                        ))
                    },
                    end: (_endRange, _closeData, contextData) => {
                        addComments(contextData, comments)
                        handleValue({
                            commentData: transformCommentsToSerializableCommentData(valueComments),
                            type: ["object", {
                                commentData: createEmptyCommentsData(),
                                properties: new InDictionary(properties, sortKeys),
                                openCharacter: isType ? "(" : "{",
                                closeCharacter: isType ? ")" : "}",
                            }],
                        })
                    },
                }
            },
            simpleValue: (_range, data) => {
                handleValue({
                    commentData: transformCommentsToSerializableCommentData(valueComments),
                    type: ["simple value", {
                        quote: data.quote === null ? null : "\"",
                        value: data.value,
                    }],
                })
                return p.value(false)
            },
            taggedUnion: () => {
                return {
                    option: (_range, option, contextData) => {
                        addComments(contextData, comments)
                        return createRequiredValueNormalizer(
                            tuData => {
                                handleValue({
                                    commentData: transformCommentsToSerializableCommentData(valueComments),
                                    type: ["tagged union", {
                                        option: option,
                                        quote: "'",
                                        commentData: createEmptyCommentsData(),
                                        data: tuData,
                                    }],
                                })
                            },
                            sortKeys,
                            comments,
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
    documentComments: astn.Comment[]
): astn.ParserEventConsumer<null, null> {

    const datasubscriber = astn.createStackedDataSubscriber<null, null>(
        {
            onValue: createValueNormalizer(handleValue, sortKeys, documentComments),
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

    const documentComments: astn.Comment[] = []

    return astn.parseString(
        dataAsString,
        _range => {
            return createNormalizer(
                sv => {
                    schemaValue = sv
                },
                sortKeys,
                documentComments,
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
                documentComments,
            )
        },
        err => { console.error("error: ", printParsingError(err)) },
        (overheadToken, range) => {
            switch (overheadToken.type[0]) {
                case astn.OverheadTokenType.Comment: {
                    const $ = overheadToken.type[1]
                    documentComments.push({
                        text: $.comment,
                        type: $.type,
                        indent: null, //FIX get the right indent info
                        outerRange: range,
                        innerRange: $.innerRange,
                    })
                    break
                }
                case astn.OverheadTokenType.NewLine: {
                    //const $ = data.type[1]

                    break
                }
                case astn.OverheadTokenType.WhiteSpace: {
                    //const $ = data.type[1]

                    break
                }
                default:
                    assertUnreachable(overheadToken.type[0])
            }
            return p.value(false)
        },
    ).mapResult(
        () => {
            if (root === null) {
                throw new Error("unexpected missing instance value")
            }

            return p.value(serializeDocument(
                {
                    schema: schemaValue,
                    compact: compact,
                    root: root,
                    documentComments: new InArray(documentComments.map(cb => {
                        return {
                            text: cb.text,
                        }
                    })),
                },
                `    `,
                true,
                `\r\n`,
            ))
            //we're only here for the side effects, so no need to handle the result (which is 'null' anyway)
        }
    )
}
