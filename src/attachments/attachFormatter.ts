import { DataSubscriber, HeaderSubscriber, Parser } from "../Parser";
import { Range, Location, printRange } from "../location";

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

export class Formatter implements DataSubscriber, HeaderSubscriber {
    private readonly documentAPI: DocumentAPI
    private readonly stack: Collection[] = []
    private currentCollection: Collection | null = null
    private indentationLevel = 0

    private previous: PreviousData = [Previous.BEGIN_OF_DOCUMENT, {}]
    constructor(documentAPI: DocumentAPI) {
        this.documentAPI = documentAPI
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
    }
    public onNewLine(range: Range) {
        if (this.currentCollection !== null) {
            this.currentCollection.contentStartsOnNewLine = true
            this.currentCollection = null
            this.indentationLevel += 1
        }
        switch (this.previous[0]) {
            case Previous.BEGIN_OF_DOCUMENT: {
                //remove newline
                this.documentAPI.remove(range.start.position, range.end.position)
                break
            }
            case Previous.INDENT: {
                const $ = this.previous[1]
                //remove indent
                //remove newline
                this.documentAPI.remove($.range.start.position, $.range.end.position)
                this.documentAPI.remove(range.start.position, range.end.position)
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
                this.documentAPI.remove(range.start.position, range.end.position)
                break
            }
            case Previous.TOKEN: {
                break
            }
            default:
                return assertUnreachable(this.previous)
        }
        this.previous = [Previous.NEWLINE, { range: range }]
    }
    public onWhitespace(value: string, range: Range) {
        switch (this.previous[0]) {
            case Previous.BEGIN_OF_DOCUMENT: {
                //remove whitespace
                this.documentAPI.remove(range.start.position, range.end.position)
                break
            }
            case Previous.INDENT: {
                console.error(`unexpected whitespace after indent whitespace @ ${printRange(range)}`)
                break
            }
            case Previous.INTRA_WHITESPACE: {
                console.error(`unexpected whitespace after intra whitespace @ ${printRange(range)}`)
                break
            }
            case Previous.NEWLINE: {
                const $ = this.previous[1]
                this.previous = [Previous.INDENT, { value: value, range: range, newLineRange: $.range }]
                break
            }
            case Previous.TOKEN: {
                //don't check the content yet. do that upon the next tokne
                const $ = this.previous[1]
                this.previous = [Previous.INTRA_WHITESPACE, { range: range, value: value, tokenBefore: $ }]
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
    public onColon(range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.NEVER)
    }
    public onComma(range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.NEVER)
    }
    public onBlockComment(_comment: string, range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onCloseArray(range: Range) {
        this.onCloseToken(range)
    }
    public onCloseObject(range: Range) {
        this.onCloseToken(range)
    }
    public onCloseTaggedUnion(_location: Location) {
        //
    }
    public onKey(_key: string, _quote: string, range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onLineComment(_comment: string, range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onOpenArray(range: Range) {
        this.onOpenToken(range)
    }
    public onOpenObject(range: Range) {
        this.onOpenToken(range)
    }
    public onOpenTaggedUnion(range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onOption(_option: string, _quote: string, range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onUnquotedToken(value: string, range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.ALWAYS)
    }
    public onQuotedString(_value: string, quote: string, range: Range) {
        this.onNonOpenToken(range.start, ExpectSpaceBefore.ALWAYS)
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

export function attachFormatter(parser: Parser, document: DocumentAPI) {

    const formatter = new Formatter(document)
    parser.ondata.subscribe(formatter)
    parser.onschemadata.subscribe(formatter)
    parser.onheaderdata.subscribe(formatter)
}