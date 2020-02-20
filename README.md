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
* the following options have been added (if none are selected, `bass-clarinet` is a pure JSON-parser):
  * `allow:angle_brackets_instead_of_brackets`
  * `allow:apostrophes_instead_of_quotation_marks`
  * `allow:comments`
  * `allow:compact`
  * `allow:missing_commas`
  * `allow:parens_instead_of_braces`
  * `allow:schema`
  * `allow:trailing_commas`
  * `allow:tagged_unions`
  * `require:schema`
  * `spaces_per_tab`
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

export function createPrettyPrinter(indentation: string, writer: (str: string) => void): bc.DataSubscriber {
    return bc.createStackedDataSubscriber(
        createValuesPrettyPrinter(indentation, writer),
        error => {
            console.error("FOUND STACKED DATA ERROR", error.message)
        },
        _comments => {
            //onEnd
        }
    )
}


const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err.message) },
    { allow: bc.lax }
)
const tokenizer = new bc.Tokenizer(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err.message) }
)
parser.ondata.subscribe(createPrettyPrinter("\r\n", str => process.stdout.write(str)))
tokenizer.write(data)
tokenizer.end()


```
## low level
``` TypeScript
import * as bc from "bass-clarinet"
import * as fs  from "fs"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, {encoding: "utf-8"})


const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err.message) },
    { allow: bc.lax }
)
const tokenizer = new bc.Tokenizer(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err.message) }
)
parser.ondata.subscribe({
    oncomma: () => {
        //place your code here
    },
    oncolon: () => {
        //place your code here
    },
    onlinecomment: (_comment, _range) => {
        //place your code here
    },
    onblockcomment: (_comment, _range, _indent) => {
        //indent can be used to strip the leading whitespace of all lines of the block comment.
        //indent indicates the indentation string found up to the `/*` characters.
        //this is only provided if the block comment starts on a new line
    },
    onquotedstring: (_value, _quote, _range) => {
        //place your code here
        //in pure JSON, only '"' is valid for _quote
    },
    onunquotedtoken: (_value, _range) => {
        //place your code here
        //in pure JSON, only "null", "true" or "false" are valid for _value
    },
    onopentaggedunion: _range => {
        //place your code here
    },
    onclosetaggedunion: () => {
        //place your code here
    },
    onoption: (_option, _range) => {
        //place your code here
    },
    onopenarray: (_openCharacterRange, _openCharacter) => {
        //place your code here
    },
    onclosearray: (_closeCharacterRange, _closeCharacter) => {
        //place your code here
    },
    onopenobject: (_startRange, _openCharacter) => {
        //place your code here
    },
    oncloseobject: (_endRange, _closeCharacter) => {
        //place your code here
    },
    onkey: (_key, _range) => {
        //place your code here
    },
    onend: () => {
        //place your code here
    },
})
tokenizer.write(data)
tokenizer.end()

```
## if the document needs to conform to an expected structure (or schema)
``` TypeScript
import * as bc from "bass-clarinet"
import * as fs from "fs"
import { ExpectContext, createStackedDataSubscriber, LocationError, RangeError } from "../src"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, { encoding: "utf-8" })

const parser = new bc.Parser(
    err => { console.error("FOUND PARSER ERROR", err.message) },
    { allow: bc.lax }
)
const tokenizer = new bc.Tokenizer(
    parser,
    err => { console.error("FOUND TOKENIZER ERROR", err.message) }
)

const ec = new ExpectContext(null, null)

/**
 * expect an object/type with 2 properties, 'prop a' and 'prop b', both numbers
 */
parser.ondata.subscribe(
    createStackedDataSubscriber(
        ec.expectType(
            {
                "prop a": ec.expectNumber((_value, _range, _comments) => {
                    //handle 'prop a'
                }),
                "prop b": ec.expectNumber(_value => {
                    //handle 'prop b'
                }),
            },
            _hasErrors => {
                //wrap up the object
            }
        ),
        error => {
            if (error.context[0] === "range") {
                throw new RangeError(error.message, error.context[1])
            } else {
                throw new LocationError(error.message, error.context[1])
            }
        },
        _comments => {
            //wrap up the document
        }
    )
)
tokenizer.write(data)
tokenizer.end()

```

## arguments

pass the following arguments to the parser function.  all are optional.

`opt` - object bag of settings.

the supported options are:
* `spaces_per_tab` - number. needed for proper column info.: Rationale: without knowing how many spaces per tab `base-clarinet` is not able to determine the colomn of a character. Default is `4` (ofcourse)
* `allow:missing_commas` - boolean. No comma's are required. Rationale: When manually editing documents, keeping track of the comma's is cumbersome. With this option this is no longer an issue
* `allow:trailing_commas` - boolean. allows commas before the `}` or the `]`. Rationale: for serializers it is easier to write a comma for every property/element instead of keeping a state that tracks if a property/element is the first one.
* `allow:comments` - boolean. allows both line comments `//` and block comments `/* */`. Rationale: when using JSON-like documents for editing, it is often useful to add comments
* `allow:apostrophes_instead_of_quotation_marks` - boolean. Allows `'` in place of `"`. Rationale: In an editor this is less intrusive (although only slightly)
* `allow:angle_brackets_instead_of_brackets` - boolean. Allows `<` and `>` in place of `[` and `]`. Rationale: a semantic distinction can be made between fixed length arrays (`ArrayType`) and variable length arrays (`lists`)
* `allow:parens_instead_of_braces` - boolean. Allows `(` and `)` in place of `{` and `}`. Rationale: a semantic distinction can be made between objctes with known properties (`Type`) and objects with dynamic keys (`dictionary`)
* `allow:schema` - boolean. If enabled, the document may start with a `!` followed by a value (`object`, `string` etc). This data can be used by a processor for schema validation. For example a string can indicate a URL of the schema.
* `require:schema` - boolean. see `allow:schema`. In this case the schema is required. This option overrides the `allow` option.
* `allow:compact` - boolean. At the beginning of a document, after the possible schema, a `#` may be placed. This is an indicator for a processor (code that uses `bass-clarinet`'s API) that the data is `compact`. `base-clarinet` only sends the `compact` flag but does not change any other behaviour. Rationale: If a schema is known, the keys of a  `Type` are known at design time. these types can therefor be converted to `ArrayTypes` and thus omit the keys without losing information. This trades in readability in favor of size. This option indicates that this happened in this document. The file can only be properly interpreted by a processor in combination with the schema.
* `allow:tagged_unions` - boolean. This allows an extra value type that is not present in JSON but is very useful. tagged unions are also known as sum types or choices, see [taggedunion]. The notation is a pipe, followed by a string, followed by any other value. eg:  ```| "the chosen option" { "my data": "foo" }```. The same information can ofcourse also be written in pure JSON with an array with 2 elements of which the first element is a string.

(`normalize` and `trim` have been dropped as this can equally well be handled in the onsimplevalue handler)

## methods

`write` - write bytes to the parser. you don't have to do this all at
once. you can keep writing as much as you want.

`end` - ends the stream. once ended, no more data may be written, it signals the  `onend` event.

## events

`onerror` - indication that something bad happened. the error will be hanging
out on `parser.error`, and must be deleted before parsing can continue. by
listening to this event, you can keep an eye on that kind of stuff. note:
this happens *much* more in strict mode. argument: instance of `Error`.

`onsimplevalue` - a simple json value.

`onopenobject` - object was opened. this is different from `clarinet` as the first key is not treated separately

`onkey` - an object key: argument: key, a string with the current key. (Also called for the first key, unlike the behaviour of `clarinet`)

`oncloseobject` - indication that an object was closed

`onopenarray` - indication that an array was opened

`onclosearray` - indication that an array was closed


`onopentaggedunion` - indication that a tagged union was opened

`onoption` - the value of the option (string)

`onclosetaggedunion` - indication that a tagged union was closed

`onend` - indication that the closed stream has ended.

`onready` - indication that the stream has reset.

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
