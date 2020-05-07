import { IDataSubscriber, OpenData, CloseData, StringData, SimpleMetaData } from "../IDataSubscriber"
import { HeaderSubscriber, Parser } from "../Parser"
import { Range, Location, printRange } from "../location"

function assertUnreachable(_x: never) {
    throw new Error("unreachable")
}

export interface DocumentAPI {
    replace(begin: number, end: number, str: string): void
    insert(position: number, str: string): void
    remove(begin: number, end: number): void
}

enum Previous {
    BEGIN_OF_DOCUMENT,
    NEWLINE,
    INDENT,
    INTRA_WHITESPACE,
    TOKEN
}

enum ExpectSpaceBefore {
    ALWAYS,
    NEVER,
    IF_NOT_OPEN_TOKEN,
}

type IntraWhitespace = {
    range: Range
    value: string
    tokenBefore: Token
}

type Token = { isOpenToken: boolean }

type PreviousData =
    | [Previous.BEGIN_OF_DOCUMENT, {}]
    | [Previous.INDENT, { value: string; newLineRange: Range; range: Range }]
    | [Previous.INTRA_WHITESPACE, IntraWhitespace]
    | [Previous.NEWLINE, { range: Range }]
    | [Previous.TOKEN, Token]

function getIndent(indentationLevel: number) {
    if (indentationLevel < 0) {
        throw new Error("NEGATIVE INDENTATION LEVEL")
    }
    let out = ""
    for (let i = 0; i !== indentationLevel; i += 1) {
        out += "\t"
    }
    return out
}

type Collection = { contentStartsOnNewLine: boolean }

export class Formatter implements IDataSubscriber, HeaderSubscriber {
    private readonly documentAPI: DocumentAPI
    private readonly stack: Collection[] = []
    private currentCollection: Collection | null = null
    private indentationLevel = 0

    private previous: PreviousData = [Previous.BEGIN_OF_DOCUMENT, {}]
    private readonly onEndCallback: () => void
    constructor(documentAPI: DocumentAPI, onEnd: () => void) {
        this.documentAPI = documentAPI
        this.onEndCallback = onEnd
    }
    public onEnd(location: Location) {
        switch (this.previous[0]) {
            case Previous.BEGIN_OF_DOCUMENT: {
                break
            }
            case Previous.INDENT: {
                const $ = this.previous[1]
                //remove indent
                this.documentAPI.remove($.range.start.position, $.range.end.position)
                break
            }
            case Previous.INTRA_WHITESPACE: {
                const $ = this.previous[1]
                //remove intra whitespace

                this.documentAPI.replace($.range.start.position, $.range.end.position, "\n")
                break
            }
            case Previous.NEWLINE: {
                break
            }
            case Previous.TOKEN: {
                //add newline

                this.documentAPI.insert(location.position, "\n")
                break
            }
            default:
                return assertUnreachable(this.previous)
        }
        this.onEndCallback()
    }
    public onNewLine(metaData: SimpleMetaData) {
        if (this.currentCollection !== null) {
            this.currentCollection.contentStartsOnNewLine = true
            this.currentCollection = null
            this.indentationLevel += 1
        }
        switch (this.previous[0]) {
            case Previous.BEGIN_OF_DOCUMENT: {
                //remove newline
                this.documentAPI.remove(metaData.range.start.position, metaData.range.end.position)
                break
            }
            case Previous.INDENT: {
                const $ = this.previous[1]
                //remove indent
                //remove newline
                this.documentAPI.remove($.range.start.position, $.range.end.position)
                this.documentAPI.remove(metaData.range.start.position, metaData.range.end.position)
                break
            }
            case Previous.INTRA_WHITESPACE: {
                const $ = this.previous[1]
                //remove intra whitespace
                this.documentAPI.remove($.range.start.position, $.range.end.position)
                break
            }
            case Previous.NEWLINE: {
                //2 newlines, remove newline
                this.documentAPI.remove(metaData.range.start.position, metaData.range.end.position)
                break
            }
            case Previous.TOKEN: {
                break
            }
            default:
                return assertUnreachable(this.previous)
        }
        this.previous = [Previous.NEWLINE, { range: metaData.range }]
    }
    public onWhitespace(value: string, metaData: SimpleMetaData) {
        switch (this.previous[0]) {
            case Previous.BEGIN_OF_DOCUMENT: {
                //remove whitespace
                this.documentAPI.remove(metaData.range.start.position, metaData.range.end.position)
                break
            }
            case Previous.INDENT: {
                console.error(`unexpected whitespace after indent whitespace @ ${printRange(metaData.range)}`)
                break
            }
            case Previous.INTRA_WHITESPACE: {
                console.error(`unexpected whitespace after intra whitespace @ ${printRange(metaData.range)}`)
                break
            }
            case Previous.NEWLINE: {
                const $ = this.previous[1]
                this.previous = [Previous.INDENT, { value: value, range: metaData.range, newLineRange: $.range }]
                break
            }
            case Previous.TOKEN: {
                //don't check the content yet. do that upon the next tokne
                const $ = this.previous[1]
                this.previous = [Previous.INTRA_WHITESPACE, { range: metaData.range, value: value, tokenBefore: $ }]
                break
            }
            default:
                return assertUnreachable(this.previous)
        }
    }
    /*
    START OF HEADER SUBSCRIBERS
    */
    public onHeaderStart(range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.NEVER)
    }
    public onCompact(range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onHeaderEnd(_range: Range) {
        //
    }
    /*
    START OF NON WHITESPACE HANDLERS
    */
    public onColon(metaData: SimpleMetaData) {
        this.onNonOpenToken(metaData.range.start, ExpectSpaceBefore.NEVER)
    }
    public onComma(metaData: SimpleMetaData) {
        this.onNonOpenToken(metaData.range.start, ExpectSpaceBefore.NEVER)
    }
    public onBlockComment(_comment: string, metaData: SimpleMetaData) {
        this.onNonOpenToken(metaData.range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onCloseArray(metaData: CloseData) {
        this.onCloseToken(metaData.range)
    }
    public onCloseObject(metaData: CloseData) {
        this.onCloseToken(metaData.range)
    }
    public onLineComment(_comment: string, metaData: SimpleMetaData) {
        this.onNonOpenToken(metaData.range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onOpenArray(metaData: OpenData) {
        this.onOpenToken(metaData.range)
    }
    public onOpenObject(metaData: OpenData) {
        this.onOpenToken(metaData.range)
    }
    public onOpenTaggedUnion(metaData: SimpleMetaData) {
        this.onNonOpenToken(metaData.range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onString(_value: string, metaData: StringData) {
        this.onNonOpenToken(metaData.range.start, ExpectSpaceBefore.ALWAYS)
    }
    /**
     * Private methods
     */
    private onNonOpenToken(location: Location, expectSpaceBefore: ExpectSpaceBefore) {
        this.onToken(location, expectSpaceBefore)
        this.previous = [Previous.TOKEN, { isOpenToken: false }]

    }
    private onToken(location: Location, expectSpaceBefore: ExpectSpaceBefore) {
        this.currentCollection = null
        switch (this.previous[0]) {
            case Previous.BEGIN_OF_DOCUMENT: {
                break
            }
            case Previous.INDENT: {
                const $ = this.previous[1]
                const expectedValue = getIndent(this.indentationLevel)
                if ($.value !== expectedValue) {
                    this.documentAPI.replace($.range.start.position, $.range.end.position, expectedValue)
                }
                break
            }
            case Previous.INTRA_WHITESPACE: {
                const $ = this.previous[1]
                switch (expectSpaceBefore) {
                    case ExpectSpaceBefore.ALWAYS: {
                        this.trimIntraWhitespace($)
                        break
                    }
                    case ExpectSpaceBefore.IF_NOT_OPEN_TOKEN: {
                        if ($.tokenBefore.isOpenToken) {
                            this.documentAPI.remove($.range.start.position, $.range.end.position)
                        }
                        break
                    }
                    case ExpectSpaceBefore.NEVER: {
                        this.documentAPI.remove($.range.start.position, $.range.end.position)
                        break
                    }
                    default:
                        return assertUnreachable(expectSpaceBefore)
                }
                break
            }
            case Previous.NEWLINE: {
                if (this.indentationLevel !== 0) {
                    this.documentAPI.insert(location.position, getIndent(this.indentationLevel))
                }
                break
            }
            case Previous.TOKEN: {
                const $ = this.previous[1]
                switch (expectSpaceBefore) {
                    case ExpectSpaceBefore.ALWAYS: {
                        this.documentAPI.insert(location.position, " ")
                        break
                    }
                    case ExpectSpaceBefore.IF_NOT_OPEN_TOKEN: {
                        if (!$.isOpenToken) {
                            this.documentAPI.insert(location.position, " ")
                        }
                        break
                    }
                    case ExpectSpaceBefore.NEVER: {
                        break
                    }
                    default:
                        return assertUnreachable(expectSpaceBefore)
                }
                break
            }
            default:
                return assertUnreachable(this.previous)
        }
    }
    private onOpenToken(range: Range) {
        this.onToken(range.start, ExpectSpaceBefore.IF_NOT_OPEN_TOKEN)
        this.previous = [Previous.TOKEN, { isOpenToken: true }]

        this.currentCollection = { contentStartsOnNewLine: false }
        this.stack.push(this.currentCollection)
    }
    private onCloseToken(range: Range) {
        this.currentCollection = null
        const coll = this.stack.pop()
        if (coll === undefined) {
            console.error("missing collection")
        } else {
            if (coll.contentStartsOnNewLine) {
                //should start on newline
                this.indentationLevel -= 1

                switch (this.previous[0]) {
                    case Previous.BEGIN_OF_DOCUMENT: {
                        break
                    }
                    case Previous.INDENT: {
                        const $ = this.previous[1]
                        const expectedValue = getIndent(this.indentationLevel)
                        if ($.value !== expectedValue) {
                            this.documentAPI.replace($.range.start.position, $.range.end.position, expectedValue)
                        }
                        break
                    }
                    case Previous.INTRA_WHITESPACE: {
                        const $ = this.previous[1]

                        this.documentAPI.replace($.range.start.position, $.range.end.position, "\n" + getIndent(this.indentationLevel))
                        break
                    }
                    case Previous.NEWLINE: {
                        this.documentAPI.insert(range.start.position, getIndent(this.indentationLevel))
                        break
                    }
                    case Previous.TOKEN: {
                        this.documentAPI.insert(range.start.position, "\n" + getIndent(this.indentationLevel))
                        break
                    }
                    default:
                        return assertUnreachable(this.previous)
                }

            } else {

                //no NEWLINE
                switch (this.previous[0]) {
                    case Previous.BEGIN_OF_DOCUMENT: {
                        break
                    }
                    case Previous.INDENT: {
                        const $ = this.previous[1]
                        //remove newline and indent
                        this.documentAPI.remove($.newLineRange.start.position, $.range.end.position)
                        break
                    }
                    case Previous.INTRA_WHITESPACE: {
                        const $ = this.previous[1]
                        this.documentAPI.remove($.range.start.position, $.range.end.position)
                        break
                    }
                    case Previous.NEWLINE: {
                        const $ = this.previous[1]
                        this.documentAPI.remove($.range.start.position, $.range.end.position)
                        break
                    }
                    case Previous.TOKEN: {
                        break
                    }
                    default:
                        return assertUnreachable(this.previous)
                }
            }
        }
        this.previous = [Previous.TOKEN, { isOpenToken: false }]
    }
    private trimIntraWhitespace(iw: IntraWhitespace) {
        if (iw.value !== " ") {
            this.documentAPI.replace(iw.range.start.position, iw.range.end.position, " ")
        }
    }
}

export function attachFormatter(parser: Parser, document: DocumentAPI, onEnd: () => void) {

    const formatter = new Formatter(document, onEnd)
    parser.ondata.subscribe(formatter)
    parser.onschemadata.subscribe(formatter)
    parser.onheaderdata.subscribe(formatter)
}