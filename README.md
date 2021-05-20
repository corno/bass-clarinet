# ASTN Toolkit

![NPM Downloads](http://img.shields.io/npm/dm/astn.svg?style=flat) ![NPM Version](http://img.shields.io/npm/v/astn.svg?style=flat)

`ASTN Toolkit` is a toolkit for parsing and generating ASTN texts.

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
  * missing commas
  * parens instead of braces
  * schema
  * trailing commas
  * tagged unions
  * tokenizer option: `spaces_per_tab`
* stream support has been dropped for now. Can be added back upon request
* There is an 'ExpectContext' class that helps processing documents that should conform to an expected structure.

the parser contained in this `ASTN Toolkit` is a sax-like streaming parser for ASTN (and JSON). just like you shouldn't use `sax` when you need `dom` you shouldn't use `astn` when you need `JSON.parse`.

When to prefer this parser over the built-in `JSON.parse`:
* you want to parse pure JSON
* you want location info
* you want the parser to continue after it encountered an error
* you work with very large files
* you want a syntax that is less strict than JSON. This might be desirable when the file needs to be edited manually. See the `options` below

# design goals

the ASTN parser is very much like [yajl] but written in TypeScript:

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
2. `npm install astn`
3. add this to your `.ts` file: `import * as astn from "astn"`

# usage

## high level

``` TypeScript
//a simple pretty printer
import * as p from "pareto"
import * as fs from "fs"
import * as astn from "astn"

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

function createRequiredValuesPrettyPrinter(indentation: string, writer: (str: string) => void): astn.RequiredValueHandler {
    return {
        onValue: createValuesPrettyPrinter(indentation, writer),
        onMissing: () => {
            //write out an empty string to fix this missing data?
        },
    }
}

function createValuesPrettyPrinter(indentation: string, writer: (str: string) => void): astn.OnValue {
    return () => {
        return {
            array: (beginRange, beginMetaData) => {
                writer(beginMetaData.openCharacter)
                return {
                    element: () => createValuesPrettyPrinter(`${indentation}\t`, writer),
                    end: _endRange => {
                        writer(`${indentation}${astn.printRange(beginRange)}`)
                    },
                }

            },
            object: (_beginRange, data) => {
                writer(data.openCharacter)
                return {
                    property: (_keyRange, key) => {
                        writer(`${indentation}\t"${key}": `)
                        return p.value(createRequiredValuesPrettyPrinter(`${indentation}\t`, writer))
                    },
                    end: endRange => {
                        writer(`${indentation}${astn.printRange(endRange)}`)
                    },
                }
            },
            simpleValue: (_range, data) => {
                if (data.quote !== null) {
                    writer(`${JSON.stringify(data.value)}`)
                } else {
                    writer(`${data.value}`)
                }
                return p.value(false)
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

export function createPrettyPrinter(indentation: string, writer: (str: string) => void): astn.ParserEventConsumer<null, null> {
    const datasubscriber = astn.createStackedDataSubscriber<null, null>(
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

astn.parseString(
    dataAsString,
    () => {
        return pp
    },
    () => {
        return pp
    },
    err => { console.error("FOUND ERROR", err) },
    () => {
        return p.value(false)
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
import * as astn from "astn"

function assertUnreachable<RT>(_x: never): RT {
    throw new Error("unreachable")
}

const [, , path] = process.argv

if (path === undefined) {
    console.error("missing path")
    process.exit(1)
}

const dataAsString = fs.readFileSync(path, { encoding: "utf-8" })

export const parserEventConsumer: astn.ParserEventConsumer<null, null> = {
    onData: data => {
        switch (data.type[0]) {
            case astn.BodyEventType.CloseArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.BodyEventType.CloseObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.BodyEventType.Colon: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.BodyEventType.Comma: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.BodyEventType.OpenArray: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.BodyEventType.OpenObject: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            case astn.BodyEventType.Overhead: {
                const $ = data.type[1]
                switch ($.type[0]) {
                    case astn.OverheadTokenType.BlockComment: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case astn.OverheadTokenType.LineComment: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case astn.OverheadTokenType.NewLine: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    case astn.OverheadTokenType.WhiteSpace: {
                        //const $ = data.type[1]
                        //place your code here
                        break
                    }
                    default:
                        assertUnreachable($.type[0])
                }
                break
            }
            case astn.BodyEventType.SimpleValue: {
                //const $ = data.type[1]
                //place your code here
                //in strict JSON, the value is a string, a number, null, true or false
                break
            }
            case astn.BodyEventType.TaggedUnion: {
                //const $ = data.type[1]
                //place your code here
                break
            }
            default:
                assertUnreachable(data.type[0])
        }
        return p.value(false)
    },
    onEnd: () => {
        //place your code here
        return p.success(null)
    },
}
const parserStack = astn.createParserStack(
    () => {
        return parserEventConsumer
    },
    () => {
        return parserEventConsumer
    },
    err => { console.error("FOUND ERROR", err) },
    () => {
        return p.value(false)
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
2. fork `astn`
3. create a new branch `git checkout -b my_branch`
4. create tests for the changes you made
5. make sure you pass both existing and newly inserted tests
6. commit your changes
7. push to your branch `git push origin my_branch`
8. create an pull request

# meta

* code: `git clone git://github.com/corno/astn.git`
* home: <http://github.com/corno/astn>
* bugs: <http://github.com/corno/astn/issues>
* build: [![build status](https://secure.travis-ci.org/corno/astn.png)](http://travis-ci.org/corno/astn)


[npm]: http://npmjs.org
[issues]: http://github.com/corno/astn/issues
[saxjs]: http://github.com/isaacs/sax-js
[yajl]: https://github.com/lloyd/yajl
[taggedunion]: https://en.wikipedia.org/wiki/Tagged_union
[blog]: http://writings.nunojob.com/2011/12/clarinet-sax-based-evented-streaming-json-parser-in-javascript-for-the-browser-and-nodejs.html
