# bass-clarinet

![NPM Downloads](http://img.shields.io/npm/dm/bass-clarinet.svg?style=flat) ![NPM Version](http://img.shields.io/npm/v/bass-clarinet.svg?style=flat)

`bass-clarinet` is a JSON parser.

It was forked from `clarinet` but the API has been changed significantly.
In addition to the port to TypeScript, the following changes have been made:
* The parser was made as robust as possible. It will try to continue parsing after an unexpected event. This is useful for editors as documents will often be in an invalid state during editing.
* `onopenobject` no longer includes the first key
* `JSONTestSuite` is added to the test set. All tests pass.
* line and column information is fixed
* the parser accepts multiple subscribers per event type
* `trim` and `normalize` options have been dropped. This can be handled by the consumer in the `onsimplevalue` callback
* there is a stack based wrapper named `createStackedDataSubscriber` which pairs `onopenobject`/`oncloseobject` and `onopenarray`/`onclosearray` events in a callback
* the following features have been added (to disallow them, attach the strictJSON validator `attachStictJSONValidator` to the parser):
  * angle brackets instead of brackets
  * apostrophes instead of quotation marks
  * comments
  * compact
  * missing commas
  * parens instead of braces
  * schema
  * trailing commas
  * tagged unions
  * tokenizer option: `spaces_per_tab`
* stream support has been dropped for now. Can be added back upon request
* There is an 'ExpectContext' class that helps processing documents that should conform to an expected structure.

`bass-clarinet` is a sax-like streaming parser for JSON. works in the browser and node.js. just like you shouldn't use `sax` when you need `dom` you shouldn't use `bass-clarinet` when you need `JSON.parse`.

Clear reasons to use `bass-clarinet` over  the built-in `JSON.parse`:
* you want location info
* you want the parser to continue after it encountered an error
* you work with very large files
* you want a syntax that is less strict than JSON. This might be desirable when the file needs to be edited manually. See the `options` below

# design goals

`bass-clarinet` is very much like [yajl] but written in TypeScript:

* written in TypeScript
* portable
* no runtime dependency on other modules
* robust (around 400 tests)
* data representation independent
* fast
* generates verbose, useful error messages including context of where
   the error occurs in the input text.
* simple to use
* tiny

# installation

## node.js

1. install [npm]
2. `npm install bass-clarinet`
3. add this to your `.ts` file: `import * as bc from "bass-clarinet"`

# usage

## high level

``` TypeScript
//a simple pretty printer
import * as bc from "bass-clarinet"
import * as fs  from "fs"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, {encoding: "utf-8"})

export function createValuesPrettyPrinter(indentation: string, writer: (str: string) => void): bc.ValueHandler {
    return {
        array: (_startLocation, openCharacter, _comments) => {
            writer(openCharacter)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                end: ((_endLocation, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                }),
            }

        },
        object: (_startlocation, openCharacter, _comments) => {
            writer(openCharacter)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}\t"${key}": `)
                    return createValuesPrettyPrinter(`${indentation}\t`, writer)
                },
                end: (_endLocation, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                },
            }
        },
        boolean: (isTrue, _range, _comments) => {
            writer(`${isTrue ? "true":"false"}`)
        },
        number: (value, _range, _comments) => {
            writer(`${value.toString(10)}`)//JSON.stringify(value)
        },
        string: (value, _range, _comments) => {
            writer(`${JSON.stringify(value)}`)//JSON.stringify(value)
        },
        null: _comments => {
            writer(`null`)
        },
        taggedUnion: (option, _unionStart, _optionRange, _comments) => {
            writer(`| "${option}" `)
            return createValuesPrettyPrinter(`${indentation}`, writer)
        },
    }
}

export function attachPrettyPrinter(parser: bc.Parser, indentation: string, writer: (str: string) => void) {
    const datasubscriber = bc.createStackedDataSubscriber(
        createValuesPrettyPrinter(indentation, writer),
        error => {
            console.error("FOUND STACKED DATA ERROR", error.message)
        },
        _comments => {
            //onEnd
        }
    )
    parser.ondata.subscribe(datasubscriber)
    parser.onschemadata.subscribe(datasubscriber)
}


const prsr = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
)

attachPrettyPrinter(prsr, "\r\n", str => process.stdout.write(str))

bc.tokenizeString(
    prsr,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    data
)

```
## low level
``` TypeScript
import * as bc from "bass-clarinet"
import * as fs from "fs"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, { encoding: "utf-8" })


const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
)
parser.ondata.subscribe({
    onComma: () => {
        //place your code here
    },
    onColon: () => {
        //place your code here
    },
    onLineComment: (_comment, _range) => {
        //place your code here
    },
    onBlockComment: (_comment, _range) => {
        //
    },
    onQuotedString: (_value, _quote, _range) => {
        //place your code here
        //in strict JSON, only '"' is valid for _quote
    },
    onUnquotedToken: (_value, _range) => {
        //place your code here
        //in strict JSON, only "null", "true" or "false" are valid for _value
    },
    onOpenTaggedUnion: _range => {
        //place your code here
    },
    onCloseTaggedUnion: () => {
        //place your code here
    },
    onOption: (_option, _range) => {
        //place your code here
    },
    onOpenArray: (_openCharacterRange, _openCharacter) => {
        //place your code here
    },
    onCloseArray: (_closeCharacterRange, _closeCharacter) => {
        //place your code here
    },
    onOpenObject: (_startRange, _openCharacter) => {
        //place your code here
    },
    onCloseObject: (_endRange, _closeCharacter) => {
        //place your code here
    },
    onKey: (_key, _range) => {
        //place your code here
    },
    onEnd: () => {
        //place your code here
    },
    onNewLine: () => {
        //
    },
    onWhitespace: () => {
        //
    },
})

bc.tokenizeString(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    data,
)

```
## if the document needs to conform to an expected structure (or schema)
``` TypeScript
import * as bc from "bass-clarinet"
import * as fs from "fs"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, { encoding: "utf-8" })

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err) },
)
const ec = new bc.ExpectContext(
    (_message, _range) => {
        throw new Error("encounterd error")
    },
    (_message, _range) => {
        throw new Error("encounterd warning")
    }
)

/**
 * expect an object/type with 2 properties, 'prop a' and 'prop b', both numbers
 */
parser.ondata.subscribe(bc.createStackedDataSubscriber(
    ec.expectType(
        (_range, _comments) => {
            //prepare code here
        },
        {
            "prop a": (_propRange, _propComments) => ec.expectNumber((_value, _range, _comments) => {
                //handle 'prop a'
            }),
            "prop b": () => ec.expectNumber(_value => {
                //handle 'prop b'
            }),
        },
        (_hasErrors, _range, _comments) => {
            //wrap up the object
        }
    ),
    error => {
        if (error.context[0] === "range") {
            throw new bc.RangeError(error.message, error.context[1])
        } else {
            throw new bc.LocationError(error.message, error.context[1])
        }
    },
    _comments => {
        //wrap up the document
    }
))

bc.tokenizeString(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err) },
    data
)

```

## arguments

pass the following argument to the tokenizer function:
* `spaces_per_tab` - number. needed for proper column info.: Rationale: without knowing how many spaces per tab `base-clarinet` is not able to determine the colomn of a character. Default is `4` (ofcourse)


pass the following arguments to the parser function.  all are optional.

`opt` - object bag of settings.


## methods

`write` - write bytes to the tokenizer. you don't have to do this all at
once. you can keep writing as much as you want.

`end` - ends the stream. once ended, no more data may be written, it signals the  `onend` event.

## additional features

the parser supports the following additional (to JSON) features

* optional commas - No comma's are required. Rationale: When manually editing documents, keeping track of the comma's is cumbersome. With this option this is no longer an issue
* trailing commas - Allows commas before the `}` or the `]`. Rationale: for serializers it is easier to write a comma for every property/element instead of keeping a state that tracks if a property/element is the first one.
* comments - Allows both line comments `//` and block comments `/* */`. Rationale: when using JSON-like documents for editing, it is often useful to add comments
* apostrophes instead of quotation marks - Allows `'` in place of `"`. Rationale: In an editor this is less intrusive (although only slightly)
* angle brackets instead of brackets - Allows `<` and `>` in place of `[` and `]`. Rationale: a semantic distinction can be made between fixed length arrays (`ArrayType`) and variable length arrays (`lists`)
* parens instead of braces - Allows `(` and `)` in place of `{` and `}`. Rationale: a semantic distinction can be made between objctes with known properties (`Type`) and objects with dynamic keys (`dictionary`)
* schema - The document may start with a `!` followed by a value (`object`, `string` etc), followed by an optional `#` (indicating `compact`).
  * * The schema value can be used by a processor for schema validation. For example a string can indicate a URL of the schema.
  * * `compact` is an indicator for a processor (code that uses `bass-clarinet`'s API) that the data is `compact`. `base-clarinet` only sends the `compact` flag but does not change any other behaviour. Rationale: If a schema is known, the keys of a  `Type` are known at design time. these types can therefor be converted to `ArrayTypes` and thus omit the keys without losing information. This trades in readability in favor of size. This option indicates that this happened in this document. The file can only be properly interpreted by a processor in combination with the schema.
* tagged unions - This allows an extra value type that is not present in JSON but is very useful. tagged unions are also known as sum types or choices, see [taggedunion]. The notation is a pipe, followed by a string, followed by any other value. eg:  ```| "the chosen option" { "my data": "foo" }```. The same information can ofcourse also be written in strict JSON with an array with 2 elements of which the first element is a string.

## events

`onerror` (passed as argument to the constructor) - indication that something bad happened. The parser will continue as good as it can

the data subscriber can be seen in the example code above:

# roadmap

check [issues]

# contribute

everyone is welcome to contribute. patches, bug-fixes, new features

1. create an [issue][issues] so the community can comment on your idea
2. fork `bass-clarinet`
3. create a new branch `git checkout -b my_branch`
4. create tests for the changes you made
5. make sure you pass both existing and newly inserted tests
6. commit your changes
7. push to your branch `git push origin my_branch`
8. create an pull request

# meta

* code: `git clone git://github.com/corno/bass-clarinet.git`
* home: <http://github.com/corno/bass-clarinet>
* bugs: <http://github.com/corno/bass-clarinet/issues>
* build: [![build status](https://secure.travis-ci.org/corno/bass-clarinet.png)](http://travis-ci.org/corno/bass-clarinet)


[npm]: http://npmjs.org
[issues]: http://github.com/corno/bass-clarinet/issues
[saxjs]: http://github.com/isaacs/sax-js
[yajl]: https://github.com/lloyd/yajl
[taggedunion]: https://en.wikipedia.org/wiki/Tagged_union
[blog]: http://writings.nunojob.com/2011/12/clarinet-sax-based-evented-streaming-json-parser-in-javascript-for-the-browser-and-nodejs.html
