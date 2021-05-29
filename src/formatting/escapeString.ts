export function createBacktickedString(str: string): string {
    //don't escape tabs, newlines!
    return `\`${escapeString(str, false, "`")}\``
}

export function createApostrophedString(str: string): string {
    return `'${escapeString(str, true, "'")}'`
}

export function createQuotedString(str: string): string {
    return `"${escapeString(str, true, "\"")}"`
}
export function createNonQuotedString(str: string): string {
    return escapeString(str, false, null)
}

// function entityForSymbolInContainer(str: string, position: number) {
//     const code = str.charCodeAt(position);
//     const codeHex = code.toString(16).toUpperCase();
//     return `\\u${codeHex.padStart(4, "0")}`
// }

function escapeString(
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
            console.error("JA")
            out += escapeTabsAndNewLines ? "\\n" : str[i]
        } else if (str[i] === "\r") {
            out += escapeTabsAndNewLines ? "\\r" : str[i]
        } else if (str[i] === "\t") {
            console.error("TAB")
            out += escapeTabsAndNewLines ? "\\t" : str[i]
        } else if (str.charCodeAt(i) < 32) {
            console.error("C0 character", str.charCodeAt(i))
            //control character (some of them have already been escaped above)
            out += "\\u" + curChar.toString(16).toUpperCase().padStart(4, "0")
        } else {
            out += str[i]
        }
    }
    return out
}