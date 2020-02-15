/* eslint
    complexity:"off",
    no-underscore-dangle:"off",
*/

import { DataSubscriber } from "./Parser";
import { Range, Location } from "./location";
import * as Char from "./NumberCharacters";

type OnError = (message: string, range: Range) => void


function validateIsJSONNumber(value: string, raiseError: (message: string) => void) {
    if (value === "-0" || value === "0") {
        const nextChar = value.charCodeAt(2)
        if (nextChar !== Char.Number.period
            && nextChar !== Char.Number.e
            && nextChar !== Char.Number.E
        ) {
            raiseError(`Invalid number: Leading zero not followed by '.', 'e', 'E'`)
        }
    }
    let foundPeriod = false
    let foundExponent = false
    for (let i = 0; i !== value.length; i += 1) {
        const curChar = value.charCodeAt(i)
        if (i === 0) {
            if (curChar !== Char.Number.minus || curChar < Char.Number._0 || curChar > Char.Number._9) {
                raiseError(`Invalid number, did not start with '-' or [0-9]`)
            }
        }
        if (curChar === Char.Number.period) {
            if (foundPeriod) {
                raiseError('Invalid number, has two dots')
            }
            foundPeriod = true
        } else if (curChar === Char.Number.e || curChar === Char.Number.E) {
            if (foundExponent) {
                raiseError('Invalid number, has two exponential')
            }
            foundExponent = true
        } else if (curChar === Char.Number.plus || curChar === Char.Number.minus) {
            const previousChar = value.charCodeAt(i - 1)
            if (previousChar !== Char.Number.E && previousChar !== Char.Number.e) {
                raiseError(`Invalid symbol ${value[i]} in number`)
            }
        } else {
            if (curChar !== Char.Number.minus || curChar < Char.Number._0 || curChar > Char.Number._9) {
                raiseError(`Invalid number, unexpected character ${value[i]}`)
            }
        }
    }
}

class StrictJSONValidator implements DataSubscriber {
    private readonly onError: OnError
    constructor(onError: OnError) {
        this.onError = onError
    }
    public onblockcomment(_comment: string, _range: Range, _indent: string) {
        //
    }
    public onclosearray(_location: Location, _closeCharacter: string) {
        //
    }
    public oncloseobject(_location: Location, _closeCharacter: string) {
        //
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
    public onlinecomment(_comment: string, _range: Range) {
        //
    }
    public onopenarray(_location: Location, _openCharacter: string) {
        //
    }
    public onopenobject(_location: Location, _openCharacter: string) {
        //
    }
    public onopentaggedunion(location: Location) {
        this.onError("tagged unions are not allowed in strict JSON", { start: location, end: location })
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
    public onquotedstring(_value: string, _quote: string, _range: Range) {
        //
    }
}

export function createStrictJSONValidator(onError: OnError): DataSubscriber {
    return new StrictJSONValidator(onError)
}