/* eslint
    complexity:"off",
    no-underscore-dangle:"off",
*/

import { DataSubscriber } from "./Parser";
import { Range } from "./location";
import * as Char from "./NumberCharacters";

type OnError = (message: string, range: Range) => void


function validateIsJSONNumber(value: string, raiseError: (message: string) => void) {
    if (value === "0") {
        return
    }
    if (value.startsWith("0")) {
        const nextChar = value.charCodeAt(1)
        if (nextChar !== Char.Number.period
            && nextChar !== Char.Number.e
            && nextChar !== Char.Number.E
        ) {
            raiseError(`Invalid number: Leading zero not followed by '.', 'e', 'E' in '${value}'`)
        }
    }
    if (value.startsWith("-0")) {
        const nextChar = value.charCodeAt(2)
        if (nextChar !== Char.Number.period
            && nextChar !== Char.Number.e
            && nextChar !== Char.Number.E
        ) {
            raiseError(`Invalid number: Leading negative zero not followed by '.', 'e', 'E' in '${value}'`)
        }
    }
    let foundPeriod = false
    let foundExponent = false
    for (let i = 0; i !== value.length; i += 1) {
        const curChar = value.charCodeAt(i)
        if (i === 0) {
            if (curChar !== Char.Number.minus && (curChar < Char.Number._0 || curChar > Char.Number._9)) {
                raiseError(`Invalid number, did not start with '-' or [0-9] but with ${value[i]}`)
            }
        } else {
            if (curChar === Char.Number.period) {
                if (foundPeriod) {
                    raiseError(`Invalid number, has two dots in '${value}'`)
                }
                foundPeriod = true
            } else if (curChar === Char.Number.e || curChar === Char.Number.E) {
                if (foundExponent) {
                    raiseError(`Invalid number, has two exponential in '${value}'`)
                }
                foundExponent = true
            } else if (curChar === Char.Number.plus || curChar === Char.Number.minus) {
                const previousChar = value.charCodeAt(i - 1)
                if (previousChar !== Char.Number.E && previousChar !== Char.Number.e) {
                    raiseError(`Invalid number, unexpected symbol ${value[i]} in '${value}'`)
                }
            } else {
                if (curChar < Char.Number._0 || curChar > Char.Number._9) {
                    raiseError(`Invalid number, unexpected character ${value[i]} in '${value}'`)
                }
            }
        }
    }
}

class StrictJSONValidator implements DataSubscriber {
    private readonly onError: OnError
    constructor(onError: OnError) {
        this.onError = onError
    }
    public onblockcomment(_comment: string, range: Range, _indent: string) {
        this.onError("block comments are not allowed in strict JSON", range)
    }
    public onclosearray(range: Range, closeCharacter: string) {
        if (closeCharacter !== "]") {
            this.onError("arrays should end with ']' in strict JSON", range)
        }
    }
    public oncloseobject(range: Range, closeCharacter: string) {
        if (closeCharacter !== "}") {
            this.onError("objects should end with '}' in strict JSON", range)
        }
    }
    public onclosetaggedunion() {
        //
    }
    public onend() {
        //
    }
    public onkey(_key: string, _range: Range) {
        //
    }
    public onlinecomment(_comment: string, range: Range) {
        this.onError("line comments are not allowed in strict JSON", range)
    }
    public onopenarray(range: Range, openCharacter: string) {
        if (openCharacter !== "[") {
            this.onError("arrays should start with '[' in strict JSON", range)
        }
    }
    public onopenobject(range: Range, openCharacter: string) {
        if (openCharacter !== "{") {
            this.onError("objects should start with '{' in strict JSON", range)
        }
    }
    public onopentaggedunion(range: Range) {
        this.onError("tagged unions are not allowed in strict JSON", range)
    }
    public onoption(_option: string, _range: Range) {
        //
    }
    public onunquotedstring(value: string, range: Range) {
        switch (value) {
            case "true": {
                return
            }
            case "false": {
                return
            }
            case "null": {
                return
            }
        }
        const firstChar = value.charCodeAt(0)
        if (firstChar === Char.Number.minus || Char.Number._0 <= firstChar && firstChar <= Char.Number._9) {
            validateIsJSONNumber(value, message => this.onError(message, range))
            return
        }
        this.onError(`invalid unquoted string, expected 'true', 'false', 'null', or a number`, range)
    }
    public onquotedstring(_value: string, quote: string, range: Range) {
        if (quote !== "\"") {
            this.onError(`invalid string, should start with'"'`, range)
        }
    }
}

export function createStrictJSONValidator(onError: OnError): DataSubscriber {
    return new StrictJSONValidator(onError)
}