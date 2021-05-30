import { SimpleValueData2 } from "../handlers"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

export function createSerializedMultilineString(
    lines: string[],
    indentation: string,
    newline: string
): string {
    //don't escape tabs, newlines!
    return `\`${lines.map((line, index) => `${index === 0 ? "" : indentation}${escapeCharacters(line, false, "`")}`).join(newline)}\``
}

export function createSerializedApostrophedString(str: string): string {
    return `'${escapeCharacters(str, true, "'")}'`
}

export function createSerializedQuotedString(str: string): string {
    return `"${escapeCharacters(str, true, "\"")}"`
}

export function createSerializedNonWrappedString(str: string): string {
    return escapeCharacters(str, false, null)
}

function escapeCharacters(
    str: string,
    escapeTabsAndNewLines: boolean,
    wrapperToEscape: string | null,
): string {
    let out = ""
    for (let i = 0; i !== str.length; i += 1) {
        const curChar = str.charCodeAt(i)


        //solidus characters ( / ) are not escaped!

        //backspace and form feed are escaped using the hexadecimal notation, not the shorthands \b and \f

        if (str[i] === "\\") {
            out += "\\\\"
        } else if (str[i] === wrapperToEscape) {
            out += "\\" + wrapperToEscape
        } else if (str[i] === "\n") {
            out += escapeTabsAndNewLines ? "\\n" : str[i]
        } else if (str[i] === "\r") {
            out += escapeTabsAndNewLines ? "\\r" : str[i]
        } else if (str[i] === "\t") {
            out += escapeTabsAndNewLines ? "\\t" : str[i]
        } else if (str.charCodeAt(i) < 32) {
            //control character (some of them have already been escaped above)
            out += "\\u" + curChar.toString(16).toUpperCase().padStart(4, "0")
        } else {
            out += str[i]
        }
    }
    return out
}