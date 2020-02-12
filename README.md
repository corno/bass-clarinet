# bass-clarinet

![NPM Downloads](http://img.shields.io/npm/dm/bass-clarinet.svg?style=flat) ![NPM Version](http://img.shields.io/npm/v/bass-clarinet.svg?style=flat)

`bass-clarinet` is a port from `clarinet` to TypeScript

In addition to the port to TypeScript, the following changes have been made:
* `onopenobject` no longer includes the first key
* `JSONTestSuite` is added to the test set. All tests pass.
* line and column information is fixed
* the parser accepts multiple subscribers per event type
* `trim` and `normalize` options have been dropped. This can be handled by the consumer in the `onsimplevalue` callback
* there is a stack based wrapper named `createStackedDataSubscriber` which pairs `onopenobject`/`oncloseobject` and `onopenarray`/`onclosearray` events in a callback
* the following options have been added (if none are selected, `base-clarinet` is a pure JSON-parser):
  * `allow:angle_brackets_instead_of_brackets`
  * `allow:apostrophes_instead_of_quotation_marks`
  * `allow:comments`
  * `allow:compact`
  * `allow:missing_commas`
  * `allow:parens_instead_of_braces`
  * `allow:schema`
  * `allow:trailing_commas`
  * `allow:tagged_unions`
  * `spaces_per_tab`
  * `require_schema`
* stream support has been dropped for now. Can be added back upon request

most credits go to the original author Nuno Job

`clarinet/bass-clarinet` is a sax-like streaming parser for JSON. works in the browser and node.js. `clarinet` was inspired (and forked) from [sax-js][saxjs]. just like you shouldn't use `sax` when you need `dom` you shouldn't use `bass-clarinet` when you need `JSON.parse`.

Clear reasons to use `bass-clarinet` over  the build in `JSON.parse`:
* you want location info
* you work with very large files
* you want a syntax that is less strict than JSON. This might be desirable when the file needs to be edited manually. See option

# design goals

`bass-clarinet` is very much like [yajl] but written in TypeScript:

* written in TypeScript
* portable
* robust (around 400 tests)
* data representation independent
* fast
* generates verbose, useful error messages including context of where
   the error occurs in the input text.
* can parse json data off a stream, incrementally
* simple to use
* tiny

# motivation

the reason behind this work was to create better full text support in node. creating indexes out of large (or many) json files doesn't require a full understanding of the json file, but it does require something like `clarinet/bass-clarinet`.

# installation

## node.js

1. install [npm]
2. `npm install bass-clarinet`
3. `import * as bass_clarinet from "bass-clarinet"`

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

function format(value: number | string | boolean | null) {
    if (typeof value === "string") {
        return `${JSON.stringify(value)}`
    } else {
        return value
    }
}


function createValuesPrettyPrinter(indentation: string, writer: (str: string) => void): bc.ValueHandler {
    return {
        array: (_location, openCharacter) => {
            writer(openCharacter)
            return {
                element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                end: ((_location, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                })
            }

        },
        object: (_location, openCharacter) => {
            writer(openCharacter)
            return {
                property: (key, _keyRange) => {
                    writer(`${indentation}\t"${key}": `)
                    return createValuesPrettyPrinter(`${indentation}\t`, writer)
                },
                end: (_location, endCharacter) => {
                    writer(`${indentation}${endCharacter}`)
                }
            }
        },
        simpleValue: (value) => {
            writer(`${format(value)}`)
        },
        null: () => {
            writer(`null`)
        },
        taggedUnion: (option, _unionStart, _optionRange) => {
            writer(`| "${option}" `)
            return createValuesPrettyPrinter(`${indentation}`, writer)
        },
    }
}

function createPrettyPrinter(indentation: string, writer: (str: string) => void): bc.DataSubscriber {
    return bc.createStackedDataSubscriber(
        createValuesPrettyPrinter(indentation, writer),
        () => {}
    )
}

const parser = new bc.Parser({ allow: bc.lax})
parser.ondata.subscribe(createPrettyPrinter("\r\n", str => process.stdout.write(str)))
parser.onerror.subscribe(err => { console.error("FOUND ERROR", err.message) })
parser.write(data)
parser.end()

```
## low level
``` TypeScript
import * as fs  from "fs"
import * as bc from "bass-clarinet"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const data = fs.readFileSync(path, {encoding: "utf-8"})

const parser = new bc.Parser({ allow: bc.lax})
parser.ondata.subscribe({
    onlinecomment: (comment, range) => {
    },
    onblockcomment: (v, indent, range) => {
        //indent can be used to strip the leading whitespace of all lines of the block comment.
        //indent indicates the indentation string found up to the `/*` characters.
        //this is only provided if the block comment starts on a new line
    },
    onsimplevalue: (value, range) => {
    },
    onopentaggedunion: (location) => {
    },
    onclosetaggedunion: () => {
    },
    onoption: (option, range) => {
    },
    onopenarray: (startLocation, openCharacter) => {
    },
    onclosearray: (endLocation, closeCharacter) => {
    },
    onopenobject: (startLocation, openCharacter) => {
    },
    oncloseobject: (endLocation, closeCharacter) => {
    },
    onkey: (key, range) => {
    },
    onend: () => {
    }
})
parser.onerror.subscribe(err => { console.error("FOUND ERROR", err.message) })
parser.write(data)
parser.end()

```

## arguments

pass the following arguments to the parser function.  all are optional.

`opt` - object bag of settings regarding string formatting.

the supported options are:
* `spaces_per_tab` - number. needed for proper column info.: Rationale: without knowing how many spaces per tab `base-clarinet` is not able to determine the colomn of a character. Default is `4` (ofcourse)
* `allow:missing_commas` - boolean. No comma's are required. Rationale: When manually editing documents, keeping track of the comma's is cumbersome. With this option this is no longer an issue
* `allow:trailing_commas` - boolean. allows commas before the `}` or the `]`. Rationale: for serializers it is easier to write a comma for every property/element instead of keeping a state that tracks if a property/element is the first one.
* `allow:comments` - boolean. allows both line comments `//` and block comments `/* */`. Rationale: when using JSON-like documents for editing, it is often useful to add comments
* `allow:apostrophes_instead_of_quotation_marks` - boolean. Allows `'` in place of `"`. Rationale: In an editor this is less intrusive (although only slightly)
* `allow:angle_brackets_instead_of_brackets` - boolean. Allows `<` and `>` in place of `[` and `]`. Rationale: visually, a distinction can be made between fixed length arrays (`ArrayType`) and variable length arrays (`lists`)
* `allow:parens_instead_of_braces` - boolean. Allows `(` and `)` in place of `{` and `}`. Rationale: visually, a distinction can be made between objctes with known properties (`Type`) and objects with dynamic keys (`dictionary`)
* `allow:schema` - boolean. If enabled, the document may start with a `!` followed by a value (`object`, `string` etc). This data can be used by a processor for schema validation. For example a string can indicate a URL of the schema.
* `require_schema` - boolean. see `allow:schema`. In this case the schema is required. This option overrides the `allow` option.
* `allow:compact` - boolean. At the beginning of a document, after the possible schema, a `#` may be placed. This is an indicator for a processor that the data is `compact`. This means that keys for `Type`-s are emitted. Rationale: If a schema is known, a lot of keys can often be omitted from the document. This option indicates that this happened in this document. The file can only be properly parsed in combination with the schema.
* `allow:tagged_unions` - boolean. This allows an extra value type that is not present in JSON but is very useful. tagged unions are also known as sum types or choices, see [taggedunion]. The notation is a pipe, followed by a string, followed by any other value. eg:  ````| "the chosen option" { "my data": "foo" }````

(`normalize` and `trim` have been dropped as this can equally well be handled in the onsimplevalue handler)

## methods

`write` - write bytes onto the stream. you don't have to do this all at
once. you can keep writing as much as you want.

`end` - ends the stream. once ended, no more data may be written, it signals the  `onend` event.

## events

`error` - indication that something bad happened. the error will be hanging
out on `parser.error`, and must be deleted before parsing can continue. by
listening to this event, you can keep an eye on that kind of stuff. note:
this happens *much* more in strict mode. argument: instance of `Error`.

`simplevalue` - a simple json value.

`openobject` - object was opened. this is different from `clarinet` as the first key is not treated separately

`key` - an object key: argument: key, a string with the current key. (Also called for the first key, unlike the behaviour of `clarinet`)

`closeobject` - indication that an object was closed

`openarray` - indication that an array was opened

`closearray` - indication that an array was closed


`opentaggedunion` - indication that a tagged union was opened

`option` - the value of the option (string)

`closetaggedunion` - indication that a tagged union was closed

`end` - indication that the closed stream has ended.

`ready` - indication that the stream has reset, and is ready to be written
to.

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
