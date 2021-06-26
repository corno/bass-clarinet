

export type TokenizerOptions = {
    spaces_per_tab?: number //eslint-disable-line
}


export type TokenError = {
    type:
    | ["unterminated block comment"]
    | ["found dangling slash at the end of the text"]
    | ["unterminated string"]
    | ["found dangling slash"]
    | ["expected hexadecimal digit", {
        found: string
    }]
    | ["expected special character after escape slash", {
        found: string
    }]
}