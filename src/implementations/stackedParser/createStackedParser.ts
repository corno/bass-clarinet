/* eslint
    no-console:"off",
    no-underscore-dangle: "off",
    complexity: off,
    max-classes-per-file: off,
*/
import * as p from "pareto"
import {
    createRangeFromSingleLocation,
    Range,
} from "../../location"
import {
    createDummyValueHandler,
} from "../dummyHandlers"
import {
    StackContext,
} from "../../interfaces/handlers"
import {
    RangeError,
} from "../../errors"
import {
    EndData,
    ITreeParserEventConsumer,
    TreeEvent,
    TreeEventType,
} from "../../interfaces/ITreeParserEventConsumer"
import {
    BeforeContextData,
    ContextData,
    ParserArrayHandler,
    ParserObjectHandler,
    ParserRequiredValueHandler,
    ParserTaggedUnionHandler,
    ParserValueHandler,
    Comment,
    ParserTreeHandler,
} from "../../interfaces/ParserAnnotationData"
import { StackedDataError } from "./functionTypes"
import { OverheadTokenType } from "../../interfaces/ITreeParser"

const DEBUG = false

class StackedDataSubscriberPanic extends RangeError {
    constructor(message: string, range: Range) {
        super(`stack panic: ${message}`, range)
    }
}

type TaggedUnionState =
    | ["expecting option", {
    }]
    | ["expecting value", ParserRequiredValueHandler]


type ContextType =
    | ["object", {
        type:
        | ["dictionary"]
        | ["verbose type"]
        readonly objectHandler: ParserObjectHandler
        propertyHandler: null | ParserRequiredValueHandler
        foundProperties: boolean
    }]
    | ["array", {
        type:
        | ["list"]
        | ["shorthand type"]
        foundElements: boolean
        readonly arrayHandler: ParserArrayHandler
    }]
    | ["taggedunion", {
        readonly handler: ParserTaggedUnionHandler
        state: TaggedUnionState
    }]

function raiseError(onError: (error: StackedDataError, range: Range) => void, error: StackedDataError, range: Range) {
    onError(error, range)
}

class CommentState {
    private comments: Comment[] = []
    flush(): BeforeContextData {
        const bcd: BeforeContextData = {
            comments: this.comments,
        }
        this.comments = []
        return bcd
    }
    onCommend(comment: Comment) {
        this.comments.push(comment)
    }
}


class SemanticState {
    currentContext: ContextType | null = null
    private readonly stack: (ContextType | null)[] = []
    private dictionaryDepth = 0
    private verboseTypeDepth = 0
    private listDepth = 0
    private shorthandTypeDepth = 0
    private taggedUnionDepth = 0
    public treeHandler: ParserTreeHandler | null //becomes null when processed

    constructor(treeHandler: ParserTreeHandler) {
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
    public pop(range: Range) {

        if (this.currentContext === null) {
            throw new StackedDataSubscriberPanic("unexpected end of stack", range)
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
            throw new StackedDataSubscriberPanic("unexpected end of stack", range)
        } else {
            if (previousContext !== null && previousContext[0] === "taggedunion") {
                const taggedUnion = previousContext[1]
                if (taggedUnion.state[0] !== "expecting value") {
                    throw new StackedDataSubscriberPanic("unexpected tagged union state", range)
                }
                taggedUnion.handler.end({
                    annotation: null,
                })
            }
            this.currentContext = previousContext
        }
    }
    public push(newContext: ContextType) {
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
    public wrapupValue(range: Range): void {
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
                        this.pop(range)
                        this.wrapupValue(range)
                    }
                    break
                }
                default:
                    return assertUnreachable(this.currentContext[0])
            }
        }
    }
    public initValueHandler(): ParserValueHandler {
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
    beforeContextData: BeforeContextData
    handler: (contextData: ContextData) => p.IValue<boolean>
}

type ProcessResult =
    | ["event", EventData]
    | ["whitespace", {
        value: string
    }]
    | ["comment", {
        comment: Comment
    }]
    | ["other"]
    | ["newline"]


function processParserEvent(
    data: TreeEvent,
    semanticState: SemanticState,
    overheadState: CommentState,
    onError: (error: StackedDataError, range: Range) => void,
): ProcessResult {


    switch (data.type[0]) {
        case TreeEventType.CloseArray: {
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
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
                                    raiseError(onError, ["missing property data"], data.annotation.range)
                                    $$2.propertyHandler.missing()
                                    $$2.propertyHandler = null
                                }
                                raiseError(onError, ["missing object close"], data.annotation.range)
                                semanticState.pop(data.annotation.range)
                                semanticState.wrapupValue(data.annotation.range)
                                break
                            }
                            case "taggedunion": {
                                //const $ = state.currentContext[1]
                                if (semanticState.currentContext[1].state[0] === "expecting value") {
                                    semanticState.currentContext[1].state[1].missing()
                                    raiseError(onError, ["missing tagged union value"], data.annotation.range)
                                } else {
                                    raiseError(onError, ["missing tagged union option and value"], data.annotation.range)
                                }
                                semanticState.pop(data.annotation.range)
                                semanticState.wrapupValue(data.annotation.range)
                                break
                            }
                            default:
                                assertUnreachable(semanticState.currentContext[0])
                        }
                    }
                    if (semanticState.currentContext === null || semanticState.currentContext[0] !== "array") {
                        raiseError(onError, ["unexpected end of array"], data.annotation.range)
                        return p.value(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        switch ($$.type[0]) {
                            case "list": {
                                if (data.annotation.tokenString !== "]") {
                                    raiseError(onError, ["unmatched list close"], data.annotation.range)

                                }
                                break
                            }
                            case "shorthand type": {
                                if (data.annotation.tokenString !== ">") {
                                    raiseError(onError, ["unmatched shorthand type close"], data.annotation.range)

                                }

                                break
                            }
                            default:
                                assertUnreachable($$.type[0])
                        }
                        $$.arrayHandler.arrayEnd({
                            annotation: {
                                tokenString: data.annotation.tokenString,
                                range: data.annotation.range,
                                contextData: contextData,
                            },
                            stackContext: semanticState.createStackContext(),
                        })
                        semanticState.pop(data.annotation.range)
                        semanticState.wrapupValue(data.annotation.range)
                        return p.value(false)
                    }
                },
            }]
        }
        case TreeEventType.CloseObject: {
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    unwindLoop: while (true) {
                        if (semanticState.currentContext === null) {
                            break unwindLoop
                        }
                        switch (semanticState.currentContext[0]) {
                            case "array": {
                                //const $ = state.currentContext[1]
                                raiseError(onError, ["missing array close"], data.annotation.range)
                                semanticState.pop(data.annotation.range)
                                semanticState.wrapupValue(data.annotation.range)
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
                                    raiseError(onError, ["missing tagged union value"], data.annotation.range)
                                } else {
                                    raiseError(onError, ["missing tagged union option and value"], data.annotation.range)
                                }
                                semanticState.pop(data.annotation.range)
                                semanticState.wrapupValue(data.annotation.range)
                                break
                            }
                            default:
                                assertUnreachable(semanticState.currentContext[0])
                        }
                    }
                    if (semanticState.currentContext === null || semanticState.currentContext[0] !== "object") {
                        raiseError(onError, ["unexpected end of object"], data.annotation.range)
                        return p.value(false)
                    } else {
                        const $$ = semanticState.currentContext[1]
                        switch ($$.type[0]) {
                            case "dictionary": {
                                if (data.annotation.tokenString !== "}") {
                                    raiseError(onError, ["unmatched dictionary close"], data.annotation.range)

                                }
                                break
                            }
                            case "verbose type": {
                                if (data.annotation.tokenString !== ")") {
                                    raiseError(onError, ["unmatched verbose type close"], data.annotation.range)

                                }

                                break
                            }
                            default:
                                assertUnreachable($$.type[0])
                        }
                        if ($$.propertyHandler !== null) {
                            //was in the middle of processing a property
                            //the key was parsed, but the data was not
                            $$.propertyHandler.missing()
                            $$.propertyHandler = null
                        }
                        $$.objectHandler.objectEnd({
                            annotation: {
                                tokenString: data.annotation.tokenString,
                                range: data.annotation.range,
                                contextData: contextData,
                            },
                            stackContext: semanticState.createStackContext(),
                        })
                        semanticState.pop(data.annotation.range)
                        semanticState.wrapupValue(data.annotation.range)
                        return p.value(false)
                    }

                },
            }]
        }
        case TreeEventType.Colon: {
            return ["other"]
        }
        case TreeEventType.Comma: {
            return ["other"]
        }
        case TreeEventType.OpenArray: {
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    const arrayHandler = semanticState.initValueHandler().array({
                        data: {
                            type: data.annotation.tokenString === "<" ? ["shorthand type"] : ["list"],
                        },
                        annotation: {
                            tokenString: data.annotation.tokenString,
                            range: data.annotation.range,
                            contextData: contextData,
                        },
                        stackContext: semanticState.createStackContext(),
                    })
                    semanticState.push(["array", {
                        foundElements: false,
                        type: data.annotation.tokenString === "<" ? ["shorthand type"] : ["list"],
                        arrayHandler: arrayHandler,
                    }])
                    return p.value(false)
                },
            }]
        }
        case TreeEventType.OpenObject: {
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    const vh = semanticState.initValueHandler()

                    const objectHandler = vh.object({
                        data: {
                            type: data.annotation.tokenString === "(" ? ["verbose type"] : ["dictionary"],
                        },
                        annotation: {
                            tokenString: data.annotation.tokenString,
                            range: data.annotation.range,
                            contextData: contextData,
                        },
                        stackContext: semanticState.createStackContext(),
                    })
                    semanticState.push(["object", {
                        foundProperties: false,
                        type: data.annotation.tokenString === "(" ? ["verbose type"] : ["dictionary"],
                        objectHandler: objectHandler,
                        propertyHandler: null,
                    }])
                    return p.value(false)
                },
            }]
        }
        case TreeEventType.Overhead: {
            const $ = data.type[1]
            switch ($.type[0]) {
                case OverheadTokenType.Comment: {
                    const $$ = $.type[1]
                    return ["comment", {
                        comment: {
                            text: $$.comment,
                            type: $$.type,
                            indent: null, //FIX get the right indent info
                            outerRange: data.annotation.range,
                            innerRange: $$.innerRange,
                        },
                    }]
                }
                case OverheadTokenType.NewLine: {
                    return ["newline"]
                }
                case OverheadTokenType.WhiteSpace: {
                    return ["whitespace", {
                        value: data.annotation.tokenString,
                    }]
                }
                default:
                    return assertUnreachable($.type[0])
            }
        }

        case TreeEventType.StringValue: {
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
                beforeContextData: overheadState.flush(),
                handler: contextData => {

                    function onStringValue(vh: ParserValueHandler, cd: ContextData): p.IValue<boolean> {
                        //if (DEBUG) { console.log("on string", $.value) }
                        semanticState.wrapupValue(data.annotation.range)
                        return vh.string({
                            data: $,
                            annotation: {
                                tokenString: valueAsString,
                                range: data.annotation.range,
                                contextData: cd,
                            },
                            stackContext: semanticState.createStackContext(),

                        })
                    }
                    if (semanticState.currentContext === null) {
                        //handle case when root value was already processed
                        const vh = semanticState.treeHandler !== null
                            ? semanticState.treeHandler.root.exists
                            : createDummyValueHandler() //unexpected, ignore
                        return onStringValue(vh, contextData)
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
                                contextData)
                        }
                        case "object": {
                            const $$ = semanticState.currentContext[1]
                            if ($$.propertyHandler === null) {
                                console.error("HANDLE MISSING KEY")
                                return p.value(false)
                            } else {
                                const $$$ = $$.propertyHandler
                                return onStringValue($$$.exists, contextData)
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
                                        annotation: {
                                            tokenString: valueAsString,
                                            range: data.annotation.range,
                                            contextData: contextData,
                                        },
                                        stackContext: semanticState.createStackContext(),
                                    })]
                                    return p.value(false)
                                }
                                case "expecting value": {
                                    const $$$ = $$.state[1]
                                    return onStringValue($$$.exists, contextData)
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
        case TreeEventType.Identifier: {
            const $ = data.type[1]

            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {

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
                                    annotation: {
                                        tokenString: $.name,
                                        range: data.annotation.range,
                                        contextData: contextData,
                                    },
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
                                        annotation: {
                                            tokenString: $.name,
                                            range: data.annotation.range,
                                            contextData: contextData,
                                        },
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

        case TreeEventType.TaggedUnion: {
            if (DEBUG) { console.log("on open tagged union") }
            return ["event", {
                beforeContextData: overheadState.flush(),
                handler: contextData => {
                    semanticState.push(["taggedunion", {
                        handler: semanticState.initValueHandler().taggedUnion({
                            annotation: {
                                tokenString: data.annotation.tokenString,
                                range: data.annotation.range,
                                contextData: contextData,
                            },
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
export function createStackedParser<ReturnType, ErrorType>(
    valueHandler: ParserTreeHandler,
    onError: (error: StackedDataError, range: Range) => void,
    onEnd: () => p.IUnsafeValue<ReturnType, ErrorType>
): ITreeParserEventConsumer<ReturnType, ErrorType> {
    const overheadState = new CommentState()
    const semanticState = new SemanticState(valueHandler)

    let cachedEvent: null | EventData = null


    return {
        onData: (data: TreeEvent): p.IValue<boolean> => {
            function flush(
                gqe: EventData,
                lineCommentAfter: Comment | null,
                after: () => p.IValue<boolean>
            ) {
                function flushContextData(before: BeforeContextData): ContextData {
                    const contextData: ContextData = {
                        before: before,
                        lineCommentAfter: lineCommentAfter,
                        indentation: data.annotation.indentation,
                    }
                    return contextData
                }

                return gqe.handler(flushContextData(gqe.beforeContextData)).mapResult(_abortRequested => {
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
            const processedParserEvent = processParserEvent(data, semanticState, overheadState, onError)

            switch (processedParserEvent[0]) {
                case "comment": {
                    const $ = processedParserEvent[1]
                    if ($.comment.type === "line" && cachedEvent !== null) {
                        const res = flush(cachedEvent, $.comment, () => p.value(false))
                        cachedEvent = null
                        return res
                    } else {
                        overheadState.onCommend($.comment)
                        return p.value(false)
                    }
                }
                case "event": {
                    return flushPossibleQueuedEvent(() => {

                        const $ = processedParserEvent[1]
                        cachedEvent = $
                        return p.value(false)

                    })
                }
                case "other": {

                    //const $ = odr[1]

                    return p.value(false)

                }
                case "whitespace": {
                    //const $ = processedParserEvent[1]

                    return p.value(false)
                }
                case "newline": {
                    return flushPossibleQueuedEvent(() => {

                        //const $ = odr[1]
                        return p.value(false)

                    })
                }
                default:
                    return assertUnreachable(processedParserEvent[0])
            }
        },
        onEnd: (aborted: boolean, endData: EndData): p.IUnsafeValue<ReturnType, ErrorType> => {
            function flushContextData(before: BeforeContextData): ContextData {
                const contextData: ContextData = {
                    before: before,
                    lineCommentAfter: null,

                    indentation: endData.indentation,
                }
                return contextData
            }
            function onEnd2() {

                const range = createRangeFromSingleLocation(endData.location)
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
                                raiseError(onError, ["unexpected end of document", { "still in": ["array"] }], range)
                                semanticState.pop(range)
                                semanticState.wrapupValue(range)
                                break
                            }
                            case "object": {
                                const $ = semanticState.currentContext[1]
                                if ($.propertyHandler !== null) {
                                    $.propertyHandler.missing()
                                    $.propertyHandler = null
                                }
                                raiseError(onError, ["unexpected end of document", { "still in": ["object"] }], range)
                                semanticState.pop(range)
                                semanticState.wrapupValue(range)
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
                                raiseError(onError, ["unexpected end of document", { "still in": ["tagged union"] }], range)
                                semanticState.pop(range)
                                semanticState.wrapupValue(range)

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
                return gqe.handler(flushContextData(gqe.beforeContextData)).try(_abortRequested => {
                    return onEnd2()
                })
            }
        },
    }
}

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}