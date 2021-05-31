/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
    complexity: off,
    max-classes-per-file: off,
*/
import * as p from "pareto"
import {
    createDummyValueHandler,
} from "../dummyHandlers"
import {
    ArrayHandler,
    ObjectHandler,
    RequiredValueHandler,
    StackContext,
    TaggedUnionHandler,
    TreeHandler,
    ValueHandler,
} from "../../interfaces/handlers"
import {
    ITreeBuilder,
    TreeBuilderEvent,
} from "../../interfaces/ITreeBuilder"
// import {
//     BeforeContextData,
//     ContextData,
//     ParserArrayHandler,
//     ParserObjectHandler,
//     ParserRequiredValueHandler,
//     ParserTaggedUnionHandler,
//     ParserValueHandler,
//     Comment,
//     ParserTreeHandler,
// } from "../../interfaces/ParserAnnotationData"
import { StackedDataError } from "./functionTypes"

const DEBUG = false

class StackedDataSubscriberPanic<Annotation> extends Error {
    constructor(message: string, _annotation: Annotation) {
        super(`stack panic: ${message}`)
    }
}

type TaggedUnionState<TokenAnnotation, NonTokenAnnotation> =
    | ["expecting option", {
    }]
    | ["expecting value", RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>]


type ContextType<TokenAnnotation, NonTokenAnnotation> =
    | ["object", {
        type:
        | ["dictionary"]
        | ["verbose type"]
        readonly objectHandler: ObjectHandler<TokenAnnotation, NonTokenAnnotation>
        propertyHandler: null | RequiredValueHandler<TokenAnnotation, NonTokenAnnotation>
        foundProperties: boolean
    }]
    | ["array", {
        type:
        | ["list"]
        | ["shorthand type"]
        foundElements: boolean
        readonly arrayHandler: ArrayHandler<TokenAnnotation, NonTokenAnnotation>
    }]
    | ["taggedunion", {
        readonly handler: TaggedUnionHandler<TokenAnnotation, NonTokenAnnotation>
        state: TaggedUnionState<TokenAnnotation, NonTokenAnnotation>
    }]

function raiseError<Annotation>(onError: (error: StackedDataError, annotation: Annotation) => void, error: StackedDataError, annotation: Annotation) {
    onError(error, annotation)
}

// class CommentState {
//     private comments: Comment[] = []
//     flush(): BeforeContextData {
//         const bcd: BeforeContextData = {
//             comments: this.comments,
//         }
//         this.comments = []
//         return bcd
//     }
//     onCommend(comment: Comment) {
//         this.comments.push(comment)
//     }
// }


class SemanticState<Annotation> {
    currentContext: ContextType<Annotation, null> | null = null
    private readonly stack: (ContextType<Annotation, null> | null)[] = []
    private dictionaryDepth = 0
    private verboseTypeDepth = 0
    private listDepth = 0
    private shorthandTypeDepth = 0
    private taggedUnionDepth = 0
    public treeHandler: TreeHandler<Annotation, null> | null //becomes null when processed

    constructor(treeHandler: TreeHandler<Annotation, null>) {
        this.treeHandler = treeHandler
    }
    public createStackContext(): StackContext {
        return {
            dictionaryDepth: this.dictionaryDepth,
            verboseTypeDepth: this.verboseTypeDepth,
            listDepth: this.listDepth,
            shorthandTypeDepth: this.shorthandTypeDepth,
            taggedUnionDepth: this.taggedUnionDepth,
        }
    }
    public pop(annotation: Annotation) {

        if (this.currentContext === null) {
            throw new StackedDataSubscriberPanic("unexpected end of stack", annotation)
        }
        switch (this.currentContext[0]) {
            case "array": {
                const $ = this.currentContext[1]
                switch ($.type[0]) {
                    case "list": {
                        this.listDepth -= 1
                        break
                    }
                    case "shorthand type": {
                        this.shorthandTypeDepth -= 1
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case "object": {
                const $ = this.currentContext[1]
                switch ($.type[0]) {
                    case "dictionary": {
                        this.dictionaryDepth -= 1
                        break
                    }
                    case "verbose type": {
                        this.verboseTypeDepth -= 1
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case "taggedunion": {
                this.taggedUnionDepth -= 1
                break
            }
            default:
                assertUnreachable(this.currentContext[0])
        }
        const previousContext = this.stack.pop()
        if (previousContext === undefined) {
            throw new StackedDataSubscriberPanic("unexpected end of stack", annotation)
        } else {
            if (previousContext !== null && previousContext[0] === "taggedunion") {
                const taggedUnion = previousContext[1]
                if (taggedUnion.state[0] !== "expecting value") {
                    throw new StackedDataSubscriberPanic("unexpected tagged union state", annotation)
                }
                taggedUnion.handler.end({
                    data: {},
                    stackContext: this.createStackContext(),
                    annotation: null,
                })
            }
            this.currentContext = previousContext
        }
    }
    public push(newContext: ContextType<Annotation, null>) {
        this.stack.push(this.currentContext)
        this.currentContext = newContext
        switch (newContext[0]) {
            case "array": {
                const $ = newContext[1]
                switch ($.type[0]) {
                    case "list": {
                        this.listDepth += 1
                        break
                    }
                    case "shorthand type": {
                        this.shorthandTypeDepth += 1
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case "object": {
                const $ = newContext[1]
                switch ($.type[0]) {
                    case "dictionary": {
                        this.dictionaryDepth += 1
                        break
                    }
                    case "verbose type": {
                        this.verboseTypeDepth += 1
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case "taggedunion": {
                this.taggedUnionDepth += 1
                break
            }
            default:
                assertUnreachable(newContext[0])
        }
    }
    public wrapupValue(annotation: Annotation): void {
        if (this.currentContext === null) {
            this.treeHandler = null
        } else {
            switch (this.currentContext[0]) {
                case "array": {
                    break
                }
                case "object": {
                    this.currentContext[1].propertyHandler = null
                    break
                }
                case "taggedunion": {
                    if (this.currentContext[1].state[0] !== "expecting value") {
                        //error is already reported by parser
                    } else {
                        this.pop(annotation)
                        this.wrapupValue(annotation)
                    }
                    break
                }
                default:
                    return assertUnreachable(this.currentContext[0])
            }
        }
    }
    public initValueHandler(): ValueHandler<Annotation, null> {
        if (this.currentContext === null) {
            const th = this.treeHandler
            if (th === null) {
                //expected end of document
                //error is already reported by parser
                return createDummyValueHandler()

            }
            return th.root.exists
        } else {
            switch (this.currentContext[0]) {
                case "array": {
                    const $ = this.currentContext[1]
                    const isFirst = !$.foundElements
                    $.foundElements = true
                    return this.currentContext[1].arrayHandler.element({
                        data: {
                            isFirst: isFirst,
                        },
                        stackContext: this.createStackContext(),
                        annotation: null,
                    })
                }
                case "object": {
                    if (this.currentContext[1].propertyHandler === null) {
                        //expected a key or end of the object
                        //error is already reported by parser
                        return createDummyValueHandler()
                    } else {
                        return this.currentContext[1].propertyHandler.exists
                    }
                }
                case "taggedunion": {
                    if (this.currentContext[1].state[0] !== "expecting value") {
                        //error is already reported by parser
                        return createDummyValueHandler()
                    } else {
                        return this.currentContext[1].state[1].exists
                    }
                }
                default:
                    return assertUnreachable(this.currentContext[0])
            }
        }
    }
}

type EventData = {
    handler: () => p.IValue<boolean>
}

type ProcessResult =
    | ["event", EventData]
    // | ["comment", {
    //     comment: Comment
    // }]
    | ["other"]


function processParserEvent<Annotation>(
    data: TreeBuilderEvent<Annotation>,
    semanticState: SemanticState<Annotation>,
    onError: (error: StackedDataError, annotation: Annotation) => void,
): ProcessResult {


    switch (data.type[0]) {
        case "close array": {
            return ["event", {
                handler: () => {
                    unwindLoop: while (true) {
                        if (semanticState.currentContext === null) {
                            break unwindLoop
                        }
                        switch (semanticState.currentContext[0]) {
                            case "array": {
                                break unwindLoop
                                //break
                            }
                            case "object": {
                                const $$2 = semanticState.currentContext[1]
                                if ($$2.propertyHandler !== null) {
                                    raiseError(onError, ["missing property data"], data.annotation)
                                    $$2.propertyHandler.missing()
                                    $$2.propertyHandler = null
                                }
                                raiseError(onError, ["missing object close"], data.annotation)
                                semanticState.pop(data.annotation)
                                semanticState.wrapupValue(data.annotation)
                                break
                            }
                            case "taggedunion": {
                                //const $ = state.currentContext[1]
                                if (semanticState.currentContext[1].state[0] === "expecting value") {
                                    semanticState.currentContext[1].state[1].missing()
                                    raiseError(onError, ["missing tagged union value"], data.annotation)
                                } else {
                                    raiseError(onError, ["missing tagged union option and value"], data.annotation)
                                }
                                semanticState.pop(data.annotation)
                                semanticState.wrapupValue(data.annotation)
                                break
                            }
                            default:
                                assertUnreachable(semanticState.currentContext[0])
                        }
                    }
                    if (semanticState.currentContext === null || semanticState.currentContext[0] !== "array") {
                        raiseError(onError, ["unexpected end of array"], data.annotation)
                        return p.value(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        switch ($$.type[0]) {
                            case "list": {
                                break
                            }
                            case "shorthand type": {

                                break
                            }
                            default:
                                assertUnreachable($$.type[0])
                        }
                        $$.arrayHandler.arrayEnd({
                            data: {},
                            annotation: data.annotation,
                            stackContext: semanticState.createStackContext(),
                        })
                        semanticState.pop(data.annotation)
                        semanticState.wrapupValue(data.annotation)
                        return p.value(false)
                    }
                },
            }]
        }
        case "close object": {
            return ["event", {
                handler: () => {
                    unwindLoop: while (true) {
                        if (semanticState.currentContext === null) {
                            break unwindLoop
                        }
                        switch (semanticState.currentContext[0]) {
                            case "array": {
                                //const $ = state.currentContext[1]
                                raiseError(onError, ["missing array close"], data.annotation)
                                semanticState.pop(data.annotation)
                                semanticState.wrapupValue(data.annotation)
                                break
                            }
                            case "object": {
                                break unwindLoop
                                break
                            }
                            case "taggedunion": {
                                //const $ = state.currentContext[1]
                                if (semanticState.currentContext[1].state[0] === "expecting value") {
                                    semanticState.currentContext[1].state[1].missing()
                                    raiseError(onError, ["missing tagged union value"], data.annotation)
                                } else {
                                    raiseError(onError, ["missing tagged union option and value"], data.annotation)
                                }
                                semanticState.pop(data.annotation)
                                semanticState.wrapupValue(data.annotation)
                                break
                            }
                            default:
                                assertUnreachable(semanticState.currentContext[0])
                        }
                    }
                    if (semanticState.currentContext === null || semanticState.currentContext[0] !== "object") {
                        raiseError(onError, ["unexpected end of object"], data.annotation)
                        return p.value(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        if ($$.propertyHandler !== null) {
                            //was in the middle of processing a property
                            //the key was parsed, but the data was not
                            $$.propertyHandler.missing()
                            $$.propertyHandler = null
                        }
                        $$.objectHandler.objectEnd({
                            data: {},
                            annotation: data.annotation,
                            stackContext: semanticState.createStackContext(),
                        })
                        semanticState.pop(data.annotation)
                        semanticState.wrapupValue(data.annotation)
                        return p.value(false)
                    }

                },
            }]
        }
        case "open array": {
            const $ = data.type[1]
            return ["event", {
                handler: () => {
                    const arrayHandler = semanticState.initValueHandler().array({
                        data: {
                            type: $.type[0] === "shorthand type" ? ["shorthand type"] : ["list"],
                        },
                        annotation: data.annotation,
                        stackContext: semanticState.createStackContext(),
                    })
                    semanticState.push(["array", {
                        foundElements: false,
                        type: $.type[0] === "shorthand type" ? ["shorthand type"] : ["list"],
                        arrayHandler: arrayHandler,
                    }])
                    return p.value(false)
                },
            }]
        }
        case "open object": {
            const $ = data.type[1]

            return ["event", {
                handler: () => {
                    const vh = semanticState.initValueHandler()

                    const objectHandler = vh.object({
                        data: {
                            type: $.type[0] === "verbose type" ? ["verbose type"] : ["dictionary"],
                        },
                        annotation: data.annotation,
                        stackContext: semanticState.createStackContext(),
                    })
                    semanticState.push(["object", {
                        foundProperties: false,
                        type: $.type[0] === "verbose type" ? ["verbose type"] : ["dictionary"],
                        objectHandler: objectHandler,
                        propertyHandler: null,
                    }])
                    return p.value(false)
                },
            }]
        }

        case "string value": {
            const $ = data.type[1]
            const valueAsString = ((): string => {
                switch ($.type[0]) {
                    case "quoted": {
                        const $$ = $.type[1]
                        return $$.value
                    }
                    case "multiline": {
                        const $$ = $.type[1]
                        return $$.lines.join("\n")
                    }
                    case "nonwrapped": {
                        const $$ = $.type[1]
                        return $$.value
                    }
                    default:
                        return assertUnreachable($.type[0])
                }
            })()
            return ["event", {
                handler: () => {

                    function onStringValue(vh: ValueHandler<Annotation, null>): p.IValue<boolean> {
                        //if (DEBUG) { console.log("on string", $.value) }
                        semanticState.wrapupValue(data.annotation)
                        return vh.string({
                            data: $,
                            annotation: data.annotation,
                            stackContext: semanticState.createStackContext(),

                        })
                    }
                    if (semanticState.currentContext === null) {
                        //handle case when root value was already processed
                        const vh = semanticState.treeHandler !== null
                            ? semanticState.treeHandler.root.exists
                            : createDummyValueHandler() //unexpected, ignore
                        return onStringValue(vh)
                    }
                    switch (semanticState.currentContext[0]) {
                        case "array": {
                            const $ = semanticState.currentContext[1]
                            const isFirst = !$.foundElements
                            $.foundElements = true
                            return onStringValue(
                                $.arrayHandler.element({
                                    data: {
                                        isFirst: isFirst,
                                    },
                                    stackContext: semanticState.createStackContext(),
                                    annotation: null,
                                }),
                                )
                        }
                        case "object": {
                            const $$ = semanticState.currentContext[1]
                            if ($$.propertyHandler === null) {
                                console.error("HANDLE MISSING KEY")
                                return p.value(false)
                            } else {
                                const $$$ = $$.propertyHandler
                                return onStringValue($$$.exists)
                            }
                        }
                        case "taggedunion": {
                            const $$ = semanticState.currentContext[1]
                            switch ($$.state[0]) {
                                case "expecting option": {
                                    //const $$$ = $$.state[1]
                                    if (DEBUG) { console.log("on option", valueAsString) }
                                    $$.state = ["expecting value", $$.handler.option({
                                        data: {
                                            option: valueAsString,
                                        },
                                        annotation: data.annotation,
                                        stackContext: semanticState.createStackContext(),
                                    })]
                                    return p.value(false)
                                }
                                case "expecting value": {
                                    const $$$ = $$.state[1]
                                    return onStringValue($$$.exists)
                                }
                                default:
                                    return assertUnreachable($$.state[0])
                            }
                        }
                        default:
                            return assertUnreachable(semanticState.currentContext[0])
                    }
                },
            }]
        }
        case "identifier": {
            const $ = data.type[1]

            return ["event", {
                handler: () => {

                    if (semanticState.currentContext === null) {
                        console.error("HANDLE KEY BEFORE TREE")
                        return p.value(false)
                    }
                    switch (semanticState.currentContext[0]) {
                        case "array": {
                            console.error("HANDLE KEY IN ARRAY")
                            return p.value(false)
                        }
                        case "object": {
                            const $$ = semanticState.currentContext[1]
                            if ($$.propertyHandler === null) {
                                const $$$ = semanticState.currentContext[1]
                                $$$.foundProperties = true
                                return $$.objectHandler.property({
                                    data: {
                                        key: $.name,
                                    },
                                    annotation: data.annotation,
                                    stackContext: semanticState.createStackContext(),
                                }).mapResult(propHandler => {
                                    $$.propertyHandler = propHandler
                                    return p.value(false)
                                })
                            } else {
                                console.error("HANDLE MISSING PROPERTY VALUE")
                                return p.value(false)
                            }
                        }
                        case "taggedunion": {
                            const $$ = semanticState.currentContext[1]
                            switch ($$.state[0]) {
                                case "expecting option": {
                                    //const $$$ = $$.state[1]
                                    $$.state = ["expecting value", $$.handler.option({
                                        data: {
                                            option: $.name,
                                        },
                                        annotation: data.annotation,
                                        stackContext: semanticState.createStackContext(),
                                    })]
                                    return p.value(false)
                                }
                                case "expecting value": {
                                    console.error("HANDLE DOUBLE OPTION")
                                    return p.value(false)
                                }
                                default:
                                    return assertUnreachable($$.state[0])
                            }
                        }
                        default:
                            return assertUnreachable(semanticState.currentContext[0])
                    }
                },
            }]
        }

        case "tagged union": {
            if (DEBUG) { console.log("on open tagged union") }
            return ["event", {
                handler: () => {
                    semanticState.push(["taggedunion", {
                        handler: semanticState.initValueHandler().taggedUnion({
                            data: {},
                            annotation: data.annotation,
                            stackContext: semanticState.createStackContext(),
                        }),
                        state: ["expecting option", {
                        }],
                    }])
                    return p.value(false)
                },
            }]
        }
        default:
            return assertUnreachable(data.type[0])
    }
}

/**
 * this function allows for capturing objects and arrays in a callback, so that the consumer does not have to match
 * 'onopenobject' with 'oncloseobject'
 * and
 * 'onopenarray' with 'onclosearray'
 */
export function createStackedParser<Annotation, ReturnType, ErrorType>(
    valueHandler: TreeHandler<Annotation, null>,
    onError: (error: StackedDataError, annotation: Annotation) => void,
    onEnd: () => p.IUnsafeValue<ReturnType, ErrorType>
): ITreeBuilder<Annotation, ReturnType, ErrorType> {
    const semanticState = new SemanticState(valueHandler)

    let cachedEvent: null | EventData = null


    return {
        onData: (data: TreeBuilderEvent<Annotation>): p.IValue<boolean> => {
            function flush(
                gqe: EventData,
                lineCommentAfter: Comment | null,
                after: () => p.IValue<boolean>
            ) {


                return gqe.handler().mapResult(_abortRequested => {
                    return after()
                })
            }
            function flushPossibleQueuedEvent(after: () => p.IValue<boolean>) {

                if (cachedEvent === null) {
                    return after()
                } else {
                    const res = flush(cachedEvent, null, after)
                    cachedEvent = null
                    return res
                }

            }
            const processedParserEvent = processParserEvent(data, semanticState, onError)

            switch (processedParserEvent[0]) {
                // case "comment": {
                //     const $ = processedParserEvent[1]
                //     if ($.comment.type === "line" && cachedEvent !== null) {
                //         const res = flush(cachedEvent, $.comment, () => p.value(false))
                //         cachedEvent = null
                //         return res
                //     } else {
                //         overheadState.onCommend($.comment)
                //         return p.value(false)
                //     }
                // }
                case "event": {
                    return flushPossibleQueuedEvent(() => {

                        const $ = processedParserEvent[1]
                        cachedEvent = $
                        return p.value(false)

                    })
                }
                case "other": {


                    return p.value(false)

                }
                default:
                    return assertUnreachable(processedParserEvent[0])
            }
        },
        onEnd: (aborted: boolean, endAnnotation: Annotation): p.IUnsafeValue<ReturnType, ErrorType> => {
            function onEnd2() {

                if (!aborted) {
                    unwindLoop: while (true) {
                        if (semanticState.currentContext === null) {

                            if (semanticState.treeHandler !== null) {
                                semanticState.treeHandler.root.missing()
                                semanticState.treeHandler = null
                            }
                            break unwindLoop
                        }
                        switch (semanticState.currentContext[0]) {
                            case "array": {
                                raiseError(onError, ["unexpected end of document", { "still in": ["array"] }], endAnnotation)
                                semanticState.pop(endAnnotation)
                                semanticState.wrapupValue(endAnnotation)
                                break
                            }
                            case "object": {
                                const $ = semanticState.currentContext[1]
                                if ($.propertyHandler !== null) {
                                    $.propertyHandler.missing()
                                    $.propertyHandler = null
                                }
                                raiseError(onError, ["unexpected end of document", { "still in": ["object"] }], endAnnotation)
                                semanticState.pop(endAnnotation)
                                semanticState.wrapupValue(endAnnotation)
                                break
                            }
                            case "taggedunion": {
                                const $ = semanticState.currentContext[1]
                                switch ($.state[0]) {
                                    case "expecting option": {
                                        //const $$ = $.state[1]
                                        $.handler.missingOption()
                                        break
                                    }
                                    case "expecting value": {
                                        const $$ = $.state[1]
                                        //option not yet parsed
                                        $$.missing()

                                        break
                                    }
                                    default:
                                        assertUnreachable($.state[0])
                                }
                                raiseError(onError, ["unexpected end of document", { "still in": ["tagged union"] }], endAnnotation)
                                semanticState.pop(endAnnotation)
                                semanticState.wrapupValue(endAnnotation)

                                break
                            }
                            default:
                                assertUnreachable(semanticState.currentContext[0])
                        }
                    }
                }
                return onEnd()
            }
            if (cachedEvent === null) {
                return onEnd2()
            } else {
                const gqe = cachedEvent
                cachedEvent = null
                return gqe.handler().try(_abortRequested => {
                    return onEnd2()
                })
            }
        },
    }
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}