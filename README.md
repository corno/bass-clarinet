# bass-clarinet

![NPM Downloads](http://img.shields.io/npm/dm/bass-clarinet.svg?style=flat) ![NPM Version](http://img.shields.io/npm/v/bass-clarinet.svg?style=flat)

`bass-clarinet` is a port from `clarinet` to TypeScript

In addition to the port to TypeScript, the following changes have been made:
* `onopenobject` no longer includes the first key
* `JSONTestSuite` is added to the test set. All tests pass.
* line and column information is fixed
* the parser accepts multiple subscribers per event type
* `trim` and `normalize` options have been dropped. This can be handled by the consumer in the `onvalue` callback
* `allow_comments` and `allow_trailing_commas` options have been added
* there is a stack based wrapper named `subscribeStack` which pairs `onopenobject`/`oncloseobject` and `onopenarray`/`onclosearray` events in a callback

most credits go to the original author Nuno Job

`clarinet/bass-clarinet` is a sax-like streaming parser for JSON. works in the browser and node.js. `clarinet` was inspired (and forked) from [sax-js][saxjs]. just like you shouldn't use `sax` when you need `dom` you shouldn't use `bass-clarinet` when you need `JSON.parse`. for a more detailed introduction and a performance study please refer to this [article][blog]. 

# design goals

`bass-clarinet` is very much like [yajl] but written in TypeScript:

* written in TypeScript
* portable
* robust (~110 tests pass before even announcing the project)
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

<!-- ## browser

1. minimize clarinet.js
2. load it into your webpage -->

# usage

## basics

``` TypeScript
import * as bass_clarinet from "bass-clarinet"
const parser = bass_clarinet.parser()

parser.onerror.subscribe((e) => {
  // an error happened. e is the error.
})
parser.onvalue.subscribe((v: string | number | boolean | null) => {
  // got some value. v is the value. can be string, number, boolean, or null.
})
parser.onopenobject = function () {
  // opened an object.
  // unlike clarinet, bass-clarinet does not handle the first key separately
})
parser.onkey = function (key) {
  // got a key in an object.
})
parser.oncloseobject = function () {
  // closed an object.
})
parser.onopenarray = function () {
  // opened an array.
})
parser.onclosearray = function () {
  // closed an array.
})
parser.onend = function () {
  // parser stream is done, and ready to have more stuff written to it.
})

parser.write('{"foo": "bar"}').close();
```

``` TypeScript
// stream usage
// takes the same options as the parser
import * as bass_clarinet from "bass-clarinet"

var stream = bass_clarinet.createStream(options);
stream.on("error", function (e) {
  // unhandled errors will throw, since this is a proper node
  // event emitter.
  console.error("error!", e)
  // clear the error
  this._parser.error = null
  this._parser.resume()
})
stream.on("openobject", function (node) {
  // same object as above
})
// pipe is supported, and it's readable/writable
// same chunks coming in also go out.
fs.createReadStream("file.json")
  .pipe(stream)
  .pipe(fs.createReadStream("file-altered.json"))
```

## arguments

pass the following arguments to the parser function.  all are optional.

`opt` - object bag of settings regarding string formatting.

currently the only supported setting is:

* `spaces_per_tab` - number. needed for proper column info.
* `allow_comments` - boolean. allows both line comments `//` and block comments `/* */`. Be aware: This is a deviation from the pure JSON standard
* `allow_trailing_commas` - boolean. allows commas before the `}` or the `]` character. Be aware: This is a deviation from the pure JSON standard
* `spaces_per_tab` - number. needed for proper column info.

(`normalize` and `trim` have been dropped as this can equally well be handled in the onvalue handler)

## methods

`write` - write bytes onto the stream. you don't have to do this all at
once. you can keep writing as much as you want.

`close` - close the stream. once closed, no more data may be written until
it is done processing the buffer, which is signaled by the `end` event.

`resume` - to gracefully handle errors, assign a listener to the `error`
event. then, when the error is taken care of, you can call `resume` to
continue parsing. otherwise, the parser will not continue while in an error
state.

## members

at all times, the parser object will have the following members:

`line`, `column`, `position` - indications of the position in the json
document where the parser currently is looking.

`closed` - boolean indicating whether or not the parser can be written to.
if it's `true`, then wait for the `ready` event to write again.

`opt` - any options passed into the constructor.

and a bunch of other stuff that you probably shouldn't touch.

## events

all events emit with a single argument. to listen to an event, assign a
function to `on<eventname>`. functions get executed in the this-context of
the parser object. the list of supported events are also in the exported
`EVENTS` array.

when using the stream interface, assign handlers using the `EventEmitter`
`on` function in the normal fashion.

`error` - indication that something bad happened. the error will be hanging
out on `parser.error`, and must be deleted before parsing can continue. by
listening to this event, you can keep an eye on that kind of stuff. note:
this happens *much* more in strict mode. argument: instance of `Error`.

`value` - a json value. argument: value, can be a bool, null, string or number

`openobject` - object was opened. argument: none (this is different from `clarinet`)

`key` - an object key: argument: key, a string with the current key. Not called for first key (use `openobject` for that).

`closeobject` - indication that an object was closed

`openarray` - indication that an array was opened

`closearray` - indication that an array was closed

`end` - indication that the closed stream has ended.

`ready` - indication that the stream has reset, and is ready to be written
to.

## samples

some [samples] are available to help you get started. one that creates a list of top npm contributors, and another that gets a bunch of data from twitter and generates valid json.

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

helpful tips:

check `index.html`. there's two env vars you can set, `CRECORD` and `CDEBUG`. 

* `CRECORD` allows you to `record` the event sequence from a new json test so you don't have to write everything. 
* `CDEBUG` can be set to `info` or `debug`. `info` will `console.log` all emits, `debug` will `console.log` what happens to each char. 

in `test/bass_clarinet.js` there's two lines you might want to change. `#8` where you define `seps`, if you are isolating a test you probably just want to run one sep, so change this array to `[undefined]`. `#718` which says `for (var key in docs) {` is where you can change the docs you want to run. e.g. to run `foobar` i would do something like `for (var key in {foobar:''}) {`.

# meta

* code: `git clone git://github.com/corno/bass-clarinet.git`
* home: <http://github.com/corno/bass-clarinet>
* bugs: <http://github.com/corno/bass-clarinet/issues>
* build: [![build status](https://secure.travis-ci.org/corno/bass-clarinet.png)](http://travis-ci.org/corno/bass-clarinet)

`(oO)--',-` in [caos]

[npm]: http://npmjs.org
[issues]: http://github.com/corno/bass-clarinet/issues
[caos]: http://caos.di.uminho.pt/
[saxjs]: http://github.com/isaacs/sax-js
[yajl]: https://github.com/lloyd/yajl
[samples]: https://github.com/corno/bass-clarinet/tree/master/samples
[blog]: http://writings.nunojob.com/2011/12/clarinet-sax-based-evented-streaming-json-parser-in-javascript-for-the-browser-and-nodejs.html
