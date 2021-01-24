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
import * as p from "pareto"
import * as fs from "fs"
import * as bc from "bass-clarinet"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

function createRequiredValuesPrettyPrinter(indentation: string, writer: (str: string) => void): bc.RequiredValueHandler {
    return {
        onValue: createValuesPrettyPrinter(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesPrettyPrinter(indentation: string, writer: (str: string) => void): bc.OnValue {
    return () => {
        return {
            array: (beginRange, beginMetaData) => {
                writer(beginMetaData.openCharacter)
                return {
                    element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                    end: _endRange => {
                        writer(`${indentation}${bc.printRange(beginRange)}`)
                    },
                }

            },
            object: (_beginRange, data) => {
                writer(data.openCharacter)
                return {
                    property: (_keyRange, key) => {
                        writer(`${indentation}\t"${key}": `)
                        return p.result(createRequiredValuesPrettyPrinter(`${indentation}\t`, writer))
                    },
                    end: endRange => {
                        writer(`${indentation}${bc.printRange(endRange)}`)
                    },
                }
            },
            simpleValue: (_range, data) => {
                if (data.quote !== null) {
                    writer(`${JSON.stringify(data.value)}`)
                } else {
                    writer(`${data.value}`)
                }
                return p.result(false)
            },
            taggedUnion: () => {
                return {
                    option: (_range, option) => {
                        writer(`| "${option}" `)
                        return createRequiredValuesPrettyPrinter(`${indentation}`, writer)
                    },
                    missingOption: () => {
                        //
                    },
                }
            },
        }
    }
}

export function createPrettyPrinter(indentation: string, writer: (str: string) => void): bc.ParserEventConsumer<null, null> {
    const datasubscriber = bc.createStackedDataSubscriber<null, null>(
        {
            onValue: createValuesPrettyPrinter(indentation, writer),
            onMissing: () => {
                //
            },
        },
        error => {
            console.error("FOUND STACKED DATA ERROR", error.message)
        },
        () => {
            //onEnd
            //no need to return an value, we're only here for the side effects, so return 'null'
            return p.success(null)
        }
    )
    return datasubscriber
}

const pp = createPrettyPrinter("\r\n", str => process.stdout.write(str))

bc.parseString(
    dataAsString,
    () => {
        return pp
    },
    () => {
        return pp
    },
    err => { console.error("FOUND ERROR", err) },
    () => {
        return p.result(false)
    },
).handle(
    () => {
        //we're only here for the side effects, so no need to handle the error
    },
    () => {
        //we're only here for the side effects, so no need to handle the result (which is 'null' anyway)
    }
)

```
## low level
``` TypeScript
import * as p from "pareto"
import * as p20 from "pareto-20"
import * as fs from "fs"
import * as bc from "bass-clarinet"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

export const parserEventConsumer: bc.ParserEventConsumer<null, null> = {
    onData: data => {
        switch (data.type[0]) {
            case bc.BodyEventType.CloseArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.CloseObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.Colon: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.Comma: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.OpenArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.OpenObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case bc.BodyEventType.Overhead: {
                const $ = data.type[1]
                switch ($.type[0]) {
                    case bc.OverheadTokenType.BlockComment: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case bc.OverheadTokenType.LineComment: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case bc.OverheadTokenType.NewLine: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case bc.OverheadTokenType.WhiteSpace: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case bc.BodyEventType.SimpleValue: {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case bc.BodyEventType.TaggedUnion: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return p.result(false)
    },
    onEnd: () => {
        //place your code here
        return p.success(null)
    },
}
const parserStack = bc.createParserStack(
    () => {
        return parserEventConsumer
    },
    () => {
        return parserEventConsumer
    },
    err => { console.error("FOUND ERROR", err) },
    () => {
        return p.result(false)
    }
)

p20.createArray([dataAsString]).streamify().handle(
    null,
    parserStack
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

the data subscriber can be seen in the example code above

# architecture

The stack consists of the following chain:
Stream -(string chunks)-> PreTokenizer -(PreToken's)-> Tokenizer -(Token's)-> Parser -(BodyEvent)-> ParserEventConsumer -(Resulting Type)-> ...


PreTokens are low level token parts. For example `BlockCommentBegin`

Tokens are higher level. For example `BlockComment`

an example of a BodyEvent is `OpenArray`

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
