/* eslint
    max-len: "off"
*/
import { TestDefinitions } from "./testDefinition";


export const JSONTests: TestDefinitions = {
    "empty": {
        text: '',
        events: [
            ["parsererror", "expected the schema start (!) or root value"],
            ["end", undefined],
            ["stacked error", "missing value"],
        ],
    },
    "just a string": {
        text: '"a string"',
        testForLocation: true,
        events: [
            ["token", "quotedstring", "a string", [1, 1, 1, 11]],
            ["end", [1, 11]],
        ],
    },
    "unterminated string": {
        text: '"an unterminated string',
        testForLocation: true,
        events: [
            ["tokenizererror", "unterminated string"],
            ["token", "quotedstring", "an unterminated string", [1, 1, 1, 24]],
            ["end", [1, 24]],
        ],
    },
    "newline": {
        text: '\n  "a string after a newline"',
        skipRoundTripCheck: true,
        testForLocation: true,
        events: [
            ["token", "quotedstring", "a string after a newline", [2, 3, 2, 29]],
            ["end", [2, 29]],
        ],
        formattedText: '\n  "a string after a newline"',
    },
    "just a number": {
        text: '42',
        testForLocation: true,
        events: [
            ["token", "unquotedtoken", "42", [1, 1, 1, 3]],
            ["end", [1, 3]],
        ],
    },
    "invalid number": {
        text: '42x',
        events: [
            ["token", "unquotedtoken", "42x", undefined],
            ["validationerror", "Invalid number, unexpected character x in '42x'"],
            ["end", undefined],
        ],
    },
    "empty array": {
        text: '[ ]',
        testForLocation: true,
        events: [
            ["token", "openarray", "[", [1, 1, 1, 2]],
            ["token", "closearray", "]", [1, 3, 1, 4]],
            ["end", [1, 4]],
        ],
    },
    "just slash": {
        text: '[ "\\\\" ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "\\", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "zero byte": {
        text: '{ "foo": "\\u0000" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "foo", undefined],
            ["token", "quotedstring", "\u0000", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "empty value": {
        text: '{ "foo": "" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "foo", undefined],
            ["token", "quotedstring", "", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "empty key": {
        text: '{ "foo": "bar", "": "baz" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "foo", undefined],
            ["token", "quotedstring", "bar", undefined],
            ["token", "quotedstring"/*key*/, "", undefined],
            ["token", "quotedstring", "baz", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "invalid key": {
        text: '{ "foo": "bar", { }: "baz" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "foo", undefined],
            ["token", "quotedstring", "bar", undefined],
            ["token", "openobject", "{", undefined],
            ["validationerror", "expected key or object end"],
            ["token", "closeobject", "}", undefined],
            ["validationerror", "did not expect a colon"],
            ["token", "quotedstring"/*key*/, "baz", undefined],
            ["token", "closeobject", "}", undefined],
            ["parsererror", "missing property value"],
            ["end", undefined],
            ["stacked error", "missing value"],
        ],
    },
    "three byte utf8": {
        text: '{ "matzue": "松江", "asakusa": "浅草" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "matzue", undefined],
            ["token", "quotedstring", "松江", undefined],
            ["token", "quotedstring"/*key*/, "asakusa", undefined],
            ["token", "quotedstring", "浅草", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "four byte utf8": {
        text: '{ "U+10ABCD": "������" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "U+10ABCD", undefined],
            ["token", "quotedstring", "������", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "bulgarian": {
        text: '[ "Да Му Еба Майката" ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "Да Му Еба Майката", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "codepoints from unicodes": {
        text: '[ "\\u004d\\u0430\\u4e8c\\ud800\\udf02" ]',
        skipRoundTripCheck: true,
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "\u004d\u0430\u4e8c\ud800\udf02", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "empty object": {
        text: '{ }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "missing property value": {
        text: '{ "foo" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "foo", undefined],
            ["token", "closeobject", "}", undefined],
            ["parsererror", "missing property value"],
            ["end", undefined],
            ["stacked error", "missing value"],
        ],
    },
    "foobar": {
        text: '{ "foo": "bar" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "foo", undefined],
            ["token", "quotedstring", "bar", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "as is": {
        text: "{ \"foo\": \"its \\\"as is\\\", \\\"yeah\", \"bar\": false }",
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "foo", undefined],
            ["token", "quotedstring", 'its "as is", "yeah', undefined],
            ["token", "quotedstring"/*key*/, "bar", undefined],
            ["token", "unquotedtoken", "false", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "array": {
        text: '[ "one", "two" ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", 'one', undefined],
            ["token", "quotedstring", 'two', undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "array fu": {
        text: '[ "foo", "bar", "baz", true, false, null, { "key": "quotedstring" }, ' +
            '[ null, null, null, [ ] ], " \\\\ " ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", 'foo', undefined],
            ["token", "quotedstring", 'bar', undefined],
            ["token", "quotedstring", 'baz', undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "unquotedtoken", "false", undefined],
            ["token", "unquotedtoken", "null", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, 'key', undefined],
            ["token", "quotedstring", "quotedstring", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "null", undefined],
            ["token", "unquotedtoken", "null", undefined],
            ["token", "unquotedtoken", "null", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "quotedstring", " \\ ", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "simple exp": {
        text: '[ 10e-01 ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "10e-01", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "nested": {
        text: '{ "a": { "b": "c" } }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "a", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "b", undefined],
            ["token", "quotedstring", "c", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
        //formattedText: ' { "a": { "b": "c" } }',
    },
    "nested array": {
        text: '{ "a": [ "b", "c" ] }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "a", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", 'b', undefined],
            ["token", "quotedstring", 'c', undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "array of objs": {
        text: '[\n { "a": "b" }, { "c": "d" } ]',
        formattedText: '[\n    { "a": "b" },\n    { "c": "d" }\n]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "a", undefined],
            ["token", "quotedstring", 'b', undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "c", undefined],
            ["token", "quotedstring", 'd', undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "two keys": {
        text: '{ "a": "b", "c": "d" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "a", undefined],
            ["token", "quotedstring", "b", undefined],
            ["token", "quotedstring"/*key*/, "c", undefined],
            ["token", "quotedstring", "d", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "key true": {
        text: '{ "foo": true, "bar": false, "baz": null }',
        testForLocation: true,
        events: [
            ["token", "openobject", "{", [1, 1, 1, 2]],
            ["token", "quotedstring"/*key*/, "foo", [1, 3, 1, 8]],
            ["token", "unquotedtoken", "true", [1, 10, 1, 14]],
            ["token", "quotedstring"/*key*/, "bar", [1, 16, 1, 21]],
            ["token", "unquotedtoken", "false", [1, 23, 1, 28]],
            ["token", "quotedstring"/*key*/, "baz", [1, 30, 1, 35]],
            ["token", "unquotedtoken", "null", [1, 37, 1, 41]],
            ["token", "closeobject", "}", [1, 42, 1, 43]],
            ["end", [1, 43]],
        ],
    },
    "obj strange strings": {
        text: '{ "foo": "bar and all\\\"", "bar": "its \\\"nice\\\"" }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "foo", undefined],
            ["token", "quotedstring", 'bar and all"', undefined],
            ["token", "quotedstring"/*key*/, "bar", undefined],
            ["token", "quotedstring", 'its "nice"', undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "bad foo bar": {
        text: '[ "foo", "bar"',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", 'foo', undefined],
            ["token", "quotedstring", 'bar', undefined],
            ['parsererror', 'unexpected end of document, still in array'],
            ["end", undefined],
            ['stacked error', 'unexpected end of document, still in array'],
        ],
    },
    "string invalid escape": {
        text: '[ "and you can\'t escape thi\s" ]',
        testForLocation: true,
        events: [
            ["token", "openarray", "[", [1, 1, 1, 2]],
            ["token", "quotedstring", 'and you can\'t escape this', [1, 3, 1, 30]],
            ["token", "closearray", "]", [1, 31, 1, 32]],
            ["end", [1, 32]],
        ],
    },
    "nuts and bolts": {
        text: '{ "boolean, true": true' +
            ', "boolean, false": false' +
            ', "null": null }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "boolean, true", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "quotedstring"/*key*/, "boolean, false", undefined],
            ["token", "unquotedtoken", "false", undefined],
            ["token", "quotedstring"/*key*/, "null", undefined],
            ["token", "unquotedtoken", "null", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "frekin string": {
        text: '[ "\\\\\\"\\"a\\"" ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", '\\\"\"a\"', undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "array of string insanity": {
        text: '[ "\\\"and this string has an escape at the beginning", ' +
            '"and this string has no escapes" ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "\"and this string has an escape at the beginning", undefined],
            ["token", "quotedstring", "and this string has no escapes", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "non utf8": {
        text: '{"CoreletAPIVersion":2,"CoreletType":"standalone",' +
            '"documentation":"A corelet that provides the capability to upload' +
            ' a folder’s contents into a user’s locker.","functions":[' +
            '{"documentation":"Displays a dialog box that allows user to ' +
            'select a folder on the local system.","name":' +
            '"ShowBrowseDialog","parameters":[{"documentation":"The ' +
            'callback function for results.","name":"callback","required":' +
            'true,"type":"callback"}]},{"documentation":"Uploads all mp3 files' +
            ' in the folder provided.","name":"UploadFolder","parameters":' +
            '[{"documentation":"The path to upload mp3 files from."' +
            ',"name":"path","required":true,"type":"string"},{"documentation":' +
            ' "The callback function for progress.","name":"callback",' +
            '"required":true,"type":"callback"}]},{"documentation":"Returns' +
            ' the server name to the current locker service.",' +
            '"name":"GetLockerService","parameters":[]},{"documentation":' +
            '"Changes the name of the locker service.","name":"SetLockerSer' +
            'vice","parameters":[{"documentation":"The value of the locker' +
            ' service to set active.","name":"LockerService","required":true' +
            ',"type":"string"}]},{"documentation":"Downloads locker files to' +
            ' the suggested folder.","name":"DownloadFile","parameters":[{"' +
            'documentation":"The origin path of the locker file.",' +
            '"name":"path","required":true,"type":"string"},{"documentation"' +
            ':"The Window destination path of the locker file.",' +
            '"name":"destination","required":true,"type":"integer"},{"docum' +
            'entation":"The callback function for progress.","name":' +
            '"callback","required":true,"type":"callback"}]}],' +
            '"name":"LockerUploader","version":{"major":0,' +
            '"micro":1,"minor":0},"versionString":"0.0.1"}',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "CoreletAPIVersion", undefined],
            ["token", "unquotedtoken", "2", undefined],
            ["token", "quotedstring"/*key*/, "CoreletType", undefined],
            ["token", "quotedstring", "standalone", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "A corelet that provides the capability to upload a folder’s contents into a user’s locker.", undefined],
            ["token", "quotedstring"/*key*/, "functions", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "Displays a dialog box that allows user to select a folder on the local system.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "ShowBrowseDialog", undefined],
            ["token", "quotedstring"/*key*/, "parameters", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "The callback function for results.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "callback", undefined],
            ["token", "quotedstring"/*key*/, "required", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "callback", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "Uploads all mp3 files in the folder provided.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "UploadFolder", undefined],
            ["token", "quotedstring"/*key*/, "parameters", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "The path to upload mp3 files from.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "path", undefined],
            ["token", "quotedstring"/*key*/, "required", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "string", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "The callback function for progress.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "callback", undefined],
            ["token", "quotedstring"/*key*/, "required", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "callback", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "Returns the server name to the current locker service.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "GetLockerService", undefined],
            ["token", "quotedstring"/*key*/, "parameters", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "Changes the name of the locker service.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "SetLockerService", undefined],
            ["token", "quotedstring"/*key*/, "parameters", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "The value of the locker service to set active.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "LockerService", undefined],
            ["token", "quotedstring"/*key*/, "required", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "string", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "Downloads locker files to the suggested folder.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "DownloadFile", undefined],
            ["token", "quotedstring"/*key*/, "parameters", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "The origin path of the locker file.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "path", undefined],
            ["token", "quotedstring"/*key*/, "required", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "string", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "The Window destination path of the locker file.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "destination", undefined],
            ["token", "quotedstring"/*key*/, "required", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "integer", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "documentation", undefined],
            ["token", "quotedstring", "The callback function for progress.", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "callback", undefined],
            ["token", "quotedstring"/*key*/, "required", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "callback", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "quotedstring"/*key*/, "name", undefined],
            ["token", "quotedstring", "LockerUploader", undefined],
            ["token", "quotedstring"/*key*/, "version", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "major", undefined],
            ["token", "unquotedtoken", "0", undefined],
            ["token", "quotedstring"/*key*/, "micro", undefined],
            ["token", "unquotedtoken", "1", undefined],
            ["token", "quotedstring"/*key*/, "minor", undefined],
            ["token", "unquotedtoken", "0", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "quotedstring"/*key*/, "versionString", undefined],
            ["token", "quotedstring", "0.0.1", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
        formattedText: `{ "CoreletAPIVersion": 2, "CoreletType": "standalone", "documentation": "A corelet that provides the capability to upload a folder’s contents into a user’s locker.", "functions": [ { "documentation": "Displays a dialog box that allows user to select a folder on the local system.", "name": "ShowBrowseDialog", "parameters": [ { "documentation": "The callback function for results.", "name": "callback", "required": true, "type": "callback" } ] }, { "documentation": "Uploads all mp3 files in the folder provided.", "name": "UploadFolder", "parameters": [ { "documentation": "The path to upload mp3 files from.", "name": "path", "required": true, "type": "string" }, { "documentation": "The callback function for progress.", "name": "callback", "required": true, "type": "callback" } ] }, { "documentation": "Returns the server name to the current locker service.", "name": "GetLockerService", "parameters": [ ] }, { "documentation": "Changes the name of the locker service.", "name": "SetLockerService", "parameters": [ { "documentation": "The value of the locker service to set active.", "name": "LockerService", "required": true, "type": "string" } ] }, { "documentation": "Downloads locker files to the suggested folder.", "name": "DownloadFile", "parameters": [ { "documentation": "The origin path of the locker file.", "name": "path", "required": true, "type": "string" }, { "documentation": "The Window destination path of the locker file.", "name": "destination", "required": true, "type": "integer" }, { "documentation": "The callback function for progress.", "name": "callback", "required": true, "type": "callback" } ] } ], "name": "LockerUploader", "version": { "major": 0, "micro": 1, "minor": 0 }, "versionString": "0.0.1" }`,
    },
    "array of arrays": {
        text: '[ [ [ [ "foo" ] ] ] ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "foo", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "low overflow": {
        text: '[ -9223372036854775808 ]',
        chunks: [
            '[ -92233720',
            '36854775808 ]',
        ],
        testForLocation: true,
        events: [
            ["token", "openarray", "[", [1, 1, 1, 2]],
            ["token", "unquotedtoken", "-9223372036854775808", [1, 3, 1, 23]],
            ["token", "closearray", "]", [1, 24, 1, 25]],
            ["end", [1, 25]],
        ],
    },
    "high overflow": {
        text: '[ 9223372036854775808 ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "9223372036854775808", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "floats": {
        text: '[ 0.1e2, 1e1, 3.141569, 10000000000000e-10 ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "0.1e2", undefined],
            ["token", "unquotedtoken", "1e1", undefined],
            ["token", "unquotedtoken", "3.141569", undefined],
            ["token", "unquotedtoken", "10000000000000e-10", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "numbers game": {
        text: '[ 1, 0, -1, -0.3, 0.3, 1343.32, 3345, 3.1e124,' +
            ' 9223372036854775807, -9223372036854775807, 0.1e2, ' +
            '1e1, 3.141569, 10000000000000e-10, ' +
            '0.00011999999999999999, 6E-06, 6E-06, 1E-06, 1E-06, ' +
            '"2009-10-20@20:38:21.539575", 9223372036854775808, ' +
            '123456789, -123456789, ' +
            '2147483647, -2147483647 ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "1", undefined],
            ["token", "unquotedtoken", "0", undefined],
            ["token", "unquotedtoken", "-1", undefined],
            ["token", "unquotedtoken", "-0.3", undefined],
            ["token", "unquotedtoken", "0.3", undefined],
            ["token", "unquotedtoken", "1343.32", undefined],
            ["token", "unquotedtoken", "3345", undefined],
            ["token", "unquotedtoken", "3.1e124", undefined],
            ["token", "unquotedtoken", "9223372036854775807", undefined],
            ["token", "unquotedtoken", "-9223372036854775807", undefined],
            ["token", "unquotedtoken", "0.1e2", undefined],
            ["token", "unquotedtoken", "1e1", undefined],
            ["token", "unquotedtoken", "3.141569", undefined],
            ["token", "unquotedtoken", "10000000000000e-10", undefined],
            ["token", "unquotedtoken", "0.00011999999999999999", undefined],
            ["token", "unquotedtoken", "6E-06", undefined],
            ["token", "unquotedtoken", "6E-06", undefined],
            ["token", "unquotedtoken", "1E-06", undefined],
            ["token", "unquotedtoken", "1E-06", undefined],
            ["token", "quotedstring", "2009-10-20@20:38:21.539575", undefined],
            ["token", "unquotedtoken", "9223372036854775808", undefined],
            ["token", "unquotedtoken", "123456789", undefined],
            ["token", "unquotedtoken", "-123456789", undefined],
            ["token", "unquotedtoken", "2147483647", undefined],
            ["token", "unquotedtoken", "-2147483647", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "johnsmith": {
        text: '{ "firstName": "John", "lastName": "Smith", "age": ' +
            '25, "address": { "streetAddress": "21 2nd Street", ' +
            '"city": "New York", "state": "NY", "postalCode": ' +
            '"10021" }, "phoneNumber": [ { "type": "home", ' +
            '"unquotedtoken": "212 555-1234" }, { "type": "fax", ' +
            '"unquotedtoken": "646 555-4567" } ] }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "firstName", undefined],
            ["token", "quotedstring", "John", undefined],
            ["token", "quotedstring"/*key*/, "lastName", undefined],
            ["token", "quotedstring", "Smith", undefined],
            ["token", "quotedstring"/*key*/, "age", undefined],
            ["token", "unquotedtoken", "25", undefined],
            ["token", "quotedstring"/*key*/, "address", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "streetAddress", undefined],
            ["token", "quotedstring", "21 2nd Street", undefined],
            ["token", "quotedstring"/*key*/, "city", undefined],
            ["token", "quotedstring", "New York", undefined],
            ["token", "quotedstring"/*key*/, "state", undefined],
            ["token", "quotedstring", "NY", undefined],
            ["token", "quotedstring"/*key*/, "postalCode", undefined],
            ["token", "quotedstring", "10021", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "quotedstring"/*key*/, "phoneNumber", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "home", undefined],
            ["token", "quotedstring"/*key*/, "unquotedtoken", undefined],
            ["token", "quotedstring", "212 555-1234", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "type", undefined],
            ["token", "quotedstring", "fax", undefined],
            ["token", "quotedstring"/*key*/, "unquotedtoken", undefined],
            ["token", "quotedstring", "646 555-4567", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "array null": {
        text: '[ null, false, true ]',
        testForLocation: true,
        chunks: [
            '[ nu',
            'll, ',
            'fa',
            'lse, ',
            'tr',
            'ue ]'],
        events: [
            ["token", "openarray", "[", [1, 1, 1, 2]],
            ["token", "unquotedtoken", "null", [1, 3, 1, 7]],
            ["token", "unquotedtoken", "false", [1, 9, 1, 14]],
            ["token", "unquotedtoken", "true", [1, 16, 1, 20]],
            ["token", "closearray", "]", [1, 21, 1, 22]],
            ["end", [1, 22]],
        ],
    },
    "empty array comma": {
        text: '{ "a": [ ], "c": { }, "b": true }',
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "a", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "quotedstring"/*key*/, "c", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "quotedstring"/*key*/, "b", undefined],
            ["token", "unquotedtoken", "true", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "incomplete json terminates ending in number": {
        text: '[ [ 1, 2, 3 ], [ 42, 0',
        testForLocation: true,
        events: [
            ["token", "openarray", "[", [1, 1, 1, 2]],
            ["token", "openarray", "[", [1, 3, 1, 4]],
            ["token", "unquotedtoken", "1", [1, 5, 1, 6]],
            ["token", "unquotedtoken", "2", [1, 8, 1, 9]],
            ["token", "unquotedtoken", "3", [1, 11, 1, 12]],
            ["token", "closearray", "]", [1, 13, 1, 14]],
            ["token", "openarray", "[", [1, 16, 1, 17]],
            ["token", "unquotedtoken", "42", [1, 18, 1, 20]],
            ["token", "unquotedtoken", "0", [1, 22, 1, 23]],
            ['parsererror', 'unexpected end of document, still in array'],
            ['parsererror', 'unexpected end of document, still in array'],
            ["end", [1, 23]],
            ['stacked error', 'unexpected end of document, still in array'],
            ['stacked error', 'unexpected end of document, still in array'],
        ],
    },
    "incomplete json terminates ending in comma": {
        text: '[ [ 1, 2, 42 ],',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "1", undefined],
            ["token", "unquotedtoken", "2", undefined],
            ["token", "unquotedtoken", "42", undefined],
            ["token", "closearray", "]", undefined],
            ['parsererror', 'unexpected end of document, still in array'],
            ["end", undefined],
            ['stacked error', 'unexpected end of document, still in array'],
        ],
    },
    "json org": {
        text: ('{\r\n' +
            '                    "glossary": {\n' +
            '                            "title": "example glossary",\n\r' +
            '            \t\t"GlossDiv": {\r\n' +
            '                                    "title": "S",\r\n' +
            '            \t\t\t"GlossList": {\r\n' +
            '                                            "GlossEntry": {\r\n' +
            '                                                    "ID": "SGML",\r\n' +
            '            \t\t\t\t\t"SortAs": "SGML",\r\n' +
            '            \t\t\t\t\t"GlossTerm": "Standard Generalized ' +
            'Markup Language",\r\n' +
            '            \t\t\t\t\t"Acronym": "SGML",\r\n' +
            '            \t\t\t\t\t"Abbrev": "ISO 8879:1986",\r\n' +
            '            \t\t\t\t\t"GlossDef": {\r\n' +
            '                                                            "para": "A meta-markup language,' +
            ' used to create markup languages such as DocBook.",\r\n' +
            '            \t\t\t\t\t\t"GlossSeeAlso": [ "GML", "XML" ]\r\n' +
            '                                                    },\r\n' +
            '            \t\t\t\t\t"GlossSee": "markup"\r\n' +
            '                                            }\r\n' +
            '                                    }\r\n' +
            '                            }\r\n' +
            '                    }\r\n' +
            '            }\r\n'),
        formattedText: `{
    "glossary": {
        "title": "example glossary",
        "GlossDiv": {
            "title": "S",
            "GlossList": {
                "GlossEntry": {
                    "ID": "SGML",
                    "SortAs": "SGML",
                    "GlossTerm": "Standard Generalized Markup Language",
                    "Acronym": "SGML",
                    "Abbrev": "ISO 8879:1986",
                    "GlossDef": {
                        "para": "A meta-markup language, used to create markup languages such as DocBook.",
                        "GlossSeeAlso": [ "GML", "XML" ]
                    },
                    "GlossSee": "markup"
                }
            }
        }
    }
}
`,
        skipRoundTripCheck: true,
        events: [
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "glossary", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "title", undefined],
            ["token", "quotedstring", "example glossary", undefined],
            ["token", "quotedstring"/*key*/, "GlossDiv", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "title", undefined],
            ["token", "quotedstring", "S", undefined],
            ["token", "quotedstring"/*key*/, "GlossList", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "GlossEntry", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "ID", undefined],
            ["token", "quotedstring", "SGML", undefined],
            ["token", "quotedstring"/*key*/, "SortAs", undefined],
            ["token", "quotedstring", "SGML", undefined],
            ["token", "quotedstring"/*key*/, "GlossTerm", undefined],
            ["token", "quotedstring", "Standard Generalized Markup Language", undefined],
            ["token", "quotedstring"/*key*/, "Acronym", undefined],
            ["token", "quotedstring", "SGML", undefined],
            ["token", "quotedstring"/*key*/, "Abbrev", undefined],
            ["token", "quotedstring", 'ISO 8879:1986', undefined],
            ["token", "quotedstring"/*key*/, "GlossDef", undefined],
            ["token", "openobject", "{", undefined],
            ["token", "quotedstring"/*key*/, "para", undefined],
            ["token", "quotedstring", 'A meta-markup language, used to create markup languages such as DocBook.', undefined],
            ["token", "quotedstring"/*key*/, "GlossSeeAlso", undefined],
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "GML", undefined],
            ["token", "quotedstring", "XML", undefined],
            ["token", "closearray", "]", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "quotedstring"/*key*/, "GlossSee", undefined],
            ["token", "quotedstring", "markup", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closeobject", "}", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "string chunk span": {
        text: '[ "L\'OrÃ©al", "LÃ©\'Oral", "Ã©alL\'Or" ]',
        chunks: [
            '[ "L\'OrÃ',
            '©al", "LÃ©\'Oral", "Ã©alL\'Or" ]'],
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", 'L\'OrÃ©al', undefined],
            ["token", "quotedstring", 'LÃ©\'Oral', undefined],
            ["token", "quotedstring", 'Ã©alL\'Or', undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "forbidden extension: apostrophe string": {
        text: "'a string'",
        events: [
            ["token", "quotedstring", "a string", undefined],
            ["validationerror", "invalid string, should start with'\"' in strict JSON"],
            ["end", undefined],
        ],
    },
    "multiline string": {
        text: '[ "a\nstring" ]',
        skipRoundTripCheck: true,
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "a\nstring", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "forbidden extension: trailing comma": {
        text: '[ 1, 2, ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "1", undefined],
            ["token", "unquotedtoken", "2", undefined],
            ["token", "closearray", "]", undefined],
            ["validationerror", "trailing commas are not allowed"],
            ["end", undefined],
        ],
    },
    "forbidden extension: block comment": {
        text: '[ 1, 2 /*a comment\n*/ ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "1", undefined],
            ["token", "unquotedtoken", "2", undefined],
            ["token", "blockcomment", "a comment\n", undefined],
            ["validationerror", "block comments are not allowed in strict JSON"],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "forbidden extension parens instead of braces": {
        text: '( "a": "foo" )',
        events: [
            ["token", "openobject", "(", undefined],
            ["validationerror", "objects should start with '{' in strict JSON"],
            ["token", "quotedstring"/*key*/, "a", undefined],
            ["token", "quotedstring", "foo", undefined],
            ["token", "closeobject", ")", undefined],
            ["validationerror", "objects should end with '}' in strict JSON"],
            ["end", undefined],
        ],
    },
    "forbidden extension missing comma": {
        text: '[ "foo" "bar" ]',
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "foo", undefined],
            ["token", "quotedstring", "bar", undefined],
            ["validationerror", "commas are required between elements in strict JSON"],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "forbidden extension: angle brackets instead of brackets": {
        text: '< "foo" >',
        events: [
            ["token", "openarray", "<", undefined],
            ["validationerror", "arrays should start with '[' in strict JSON"],
            ["token", "quotedstring", "foo", undefined],
            ["token", "closearray", ">", undefined],
            ["validationerror", "arrays should end with ']' in strict JSON"],
            ["end", undefined],
        ],
    },
    "forbidden extension: single line comment": {
        text: '[ 1, 2 //a comment\n]',
        skipRoundTripCheck: true,
        events: [
            ["token", "openarray", "[", undefined],
            ["token", "unquotedtoken", "1", undefined],
            ["token", "unquotedtoken", "2", undefined],
            ["token", "linecomment", "a comment", undefined],
            ["validationerror", "line comments are not allowed in strict JSON"],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "forbidden extension: tagged union": {
        text: '| "foo" "x"',
        events: [
            ["token", "opentaggedunion", undefined],
            ["validationerror", "tagged unions are not allowed in strict JSON"],
            ["token", "quotedstring"/*option*/, "foo", undefined],
            ["token", "quotedstring", "x", undefined],
            //["closetaggedunion"],
            ["end", undefined],
        ],
    },
    "forbidden extension: schema": {
        text: '!"foo" { }',
        testHeaders: true,
        events: [
            ["token", "schema data start"],
            ["validationerror", "headers are not allowed in strict JSON"],
            ["token", "quotedstring", "foo", undefined],
            ["end", undefined],
            ["instance data start", false],
            ["token", "openobject", "{", undefined],
            ["token", "closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "unclosed object": {
        text: '{',
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "openobject", "{", undefined],
            ["parsererror", "unexpected end of document, still in object"],
            ["end", undefined],
            ["stacked error", "unexpected end of document, still in object"],
        ],
    },
    "wrong inline formatting": {
        text: '[ "",\n""]',
        formattedText: '[ "", "" ]',
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "", undefined],
            ["token", "quotedstring", "", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "wrong block formatting": {
        text: '[ \n"",""]',
        formattedText: '[\n    "",\n    ""\n]',
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "openarray", "[", undefined],
            ["token", "quotedstring", "", undefined],
            ["token", "quotedstring", "", undefined],
            ["token", "closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "trailing whitespace": {
        text: '"foo" ',
        formattedText: '"foo" ',
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "quotedstring", "foo", undefined],
            ["end", undefined],
        ],
    },
}
