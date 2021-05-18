/* eslint
    max-len: "off"
*/
import { TestDefinitions } from "../TestDefinition";


export const ownJSONTests: TestDefinitions = {
    "empty": {
        text: '',
        events: [
            ["parsingerror", "expected the schema start (!) or root value"],
            ["end", null],
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
            ["parsingerror", "unterminated string"],
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
            ["token", "unquotedtoken", "42x", null],
            ["validationerror", "Invalid number, unexpected character x in '42x'"],
            ["end", null],
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
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "\\", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "zero byte": {
        text: '{ "foo": "\\u0000" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "\u0000", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "empty value": {
        text: '{ "foo": "" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "empty key": {
        text: '{ "foo": "bar", "": "baz" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "bar", null],
            ["token", "quotedstring", "", null],
            ["token", "quotedstring", "baz", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "invalid key": {
        text: '{ "foo": "bar", { }: "baz" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "bar", null],
            ["token", "openobject", "{", null],
            ["validationerror", "expected key or object end"],
            ["token", "closeobject", "}", null],
            ["validationerror", "did not expect a colon"],
            ["token", "quotedstring", "baz", null],
            ["token", "closeobject", "}", null],
            ["parsingerror", "missing property value"],
            ["end", null],
            ["stacked error", "missing value"],
        ],
    },
    "three byte utf8": {
        text: '{ "matzue": "松江", "asakusa": "浅草" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "matzue", null],
            ["token", "quotedstring", "松江", null],
            ["token", "quotedstring", "asakusa", null],
            ["token", "quotedstring", "浅草", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "four byte utf8": {
        text: '{ "U+10ABCD": "������" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "U+10ABCD", null],
            ["token", "quotedstring", "������", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "bulgarian": {
        text: '[ "Да Му Еба Майката" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "Да Му Еба Майката", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "codepoints from unicodes": {
        text: '[ "\\u004d\\u0430\\u4e8c\\ud800\\udf02" ]',
        skipRoundTripCheck: true,
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "\u004d\u0430\u4e8c\ud800\udf02", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "empty object": {
        text: '{ }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "missing property value": {
        text: '{ "foo" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "closeobject", "}", null],
            ["parsingerror", "missing property value"],
            ["end", null],
            ["stacked error", "missing value"],
        ],
    },
    "foobar": {
        text: '{ "foo": "bar" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "bar", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "as is": {
        text: "{ \"foo\": \"its \\\"as is\\\", \\\"yeah\", \"bar\": false }",
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", 'its "as is", "yeah', null],
            ["token", "quotedstring", "bar", null],
            ["token", "unquotedtoken", "false", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "array": {
        text: '[ "one", "two" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", 'one', null],
            ["token", "quotedstring", 'two', null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "array fu": {
        text: '[ "foo", "bar", "baz", true, false, null, { "key": "quotedstring" }, ' +
            '[ null, null, null, [ ] ], " \\\\ " ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", 'foo', null],
            ["token", "quotedstring", 'bar', null],
            ["token", "quotedstring", 'baz', null],
            ["token", "unquotedtoken", "true", null],
            ["token", "unquotedtoken", "false", null],
            ["token", "unquotedtoken", "null", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", 'key', null],
            ["token", "quotedstring", "quotedstring", null],
            ["token", "closeobject", "}", null],
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "null", null],
            ["token", "unquotedtoken", "null", null],
            ["token", "unquotedtoken", "null", null],
            ["token", "openarray", "[", null],
            ["token", "closearray", "]", null],
            ["token", "closearray", "]", null],
            ["token", "quotedstring", " \\ ", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "simple exp": {
        text: '[ 10e-01 ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "10e-01", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "nested": {
        text: '{ "a": { "b": "c" } }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "a", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "b", null],
            ["token", "quotedstring", "c", null],
            ["token", "closeobject", "}", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
        //formattedText: ' { "a": { "b": "c" } }',
    },
    "nested array": {
        text: '{ "a": [ "b", "c" ] }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "a", null],
            ["token", "openarray", "[", null],
            ["token", "quotedstring", 'b', null],
            ["token", "quotedstring", 'c', null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "array of objs": {
        text: '[\n { "a": "b" }, { "c": "d" } ]',
        formattedText: '[\n    { "a": "b" },\n    { "c": "d" }\n]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "a", null],
            ["token", "quotedstring", 'b', null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "c", null],
            ["token", "quotedstring", 'd', null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "two keys": {
        text: '{ "a": "b", "c": "d" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "a", null],
            ["token", "quotedstring", "b", null],
            ["token", "quotedstring", "c", null],
            ["token", "quotedstring", "d", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "key true": {
        text: '{ "foo": true, "bar": false, "baz": null }',
        testForLocation: true,
        events: [
            ["token", "openobject", "{", [1, 1, 1, 2]],
            ["token", "quotedstring", "foo", [1, 3, 1, 8]],
            ["token", "unquotedtoken", "true", [1, 10, 1, 14]],
            ["token", "quotedstring", "bar", [1, 16, 1, 21]],
            ["token", "unquotedtoken", "false", [1, 23, 1, 28]],
            ["token", "quotedstring", "baz", [1, 30, 1, 35]],
            ["token", "unquotedtoken", "null", [1, 37, 1, 41]],
            ["token", "closeobject", "}", [1, 42, 1, 43]],
            ["end", [1, 43]],
        ],
    },
    "obj strange strings": {
        text: '{ "foo": "bar and all\\\"", "bar": "its \\\"nice\\\"" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", 'bar and all"', null],
            ["token", "quotedstring", "bar", null],
            ["token", "quotedstring", 'its "nice"', null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "bad foo bar": {
        text: '[ "foo", "bar"',
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", 'foo', null],
            ["token", "quotedstring", 'bar', null],
            ['parsingerror', 'unexpected end of document, still in array'],
            ["end", null],
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
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "boolean, true", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "quotedstring", "boolean, false", null],
            ["token", "unquotedtoken", "false", null],
            ["token", "quotedstring", "null", null],
            ["token", "unquotedtoken", "null", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "frekin string": {
        text: '[ "\\\\\\"\\"a\\"" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", '\\\"\"a\"', null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "array of string insanity": {
        text: '[ "\\\"and this string has an escape at the beginning", ' +
            '"and this string has no escapes" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "\"and this string has an escape at the beginning", null],
            ["token", "quotedstring", "and this string has no escapes", null],
            ["token", "closearray", "]", null],
            ["end", null],
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
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "CoreletAPIVersion", null],
            ["token", "unquotedtoken", "2", null],
            ["token", "quotedstring", "CoreletType", null],
            ["token", "quotedstring", "standalone", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "A corelet that provides the capability to upload a folder’s contents into a user’s locker.", null],
            ["token", "quotedstring", "functions", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "Displays a dialog box that allows user to select a folder on the local system.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "ShowBrowseDialog", null],
            ["token", "quotedstring", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "The callback function for results.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "callback", null],
            ["token", "quotedstring", "required", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "callback", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "Uploads all mp3 files in the folder provided.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "UploadFolder", null],
            ["token", "quotedstring", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "The path to upload mp3 files from.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "path", null],
            ["token", "quotedstring", "required", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "string", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "The callback function for progress.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "callback", null],
            ["token", "quotedstring", "required", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "callback", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "Returns the server name to the current locker service.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "GetLockerService", null],
            ["token", "quotedstring", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "Changes the name of the locker service.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "SetLockerService", null],
            ["token", "quotedstring", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "The value of the locker service to set active.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "LockerService", null],
            ["token", "quotedstring", "required", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "string", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "Downloads locker files to the suggested folder.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "DownloadFile", null],
            ["token", "quotedstring", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "The origin path of the locker file.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "path", null],
            ["token", "quotedstring", "required", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "string", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "The Window destination path of the locker file.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "destination", null],
            ["token", "quotedstring", "required", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "integer", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "documentation", null],
            ["token", "quotedstring", "The callback function for progress.", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "callback", null],
            ["token", "quotedstring", "required", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "callback", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "quotedstring", "name", null],
            ["token", "quotedstring", "LockerUploader", null],
            ["token", "quotedstring", "version", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "major", null],
            ["token", "unquotedtoken", "0", null],
            ["token", "quotedstring", "micro", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "quotedstring", "minor", null],
            ["token", "unquotedtoken", "0", null],
            ["token", "closeobject", "}", null],
            ["token", "quotedstring", "versionString", null],
            ["token", "quotedstring", "0.0.1", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
        formattedText: `{ "CoreletAPIVersion": 2, "CoreletType": "standalone", "documentation": "A corelet that provides the capability to upload a folder’s contents into a user’s locker.", "functions": [ { "documentation": "Displays a dialog box that allows user to select a folder on the local system.", "name": "ShowBrowseDialog", "parameters": [ { "documentation": "The callback function for results.", "name": "callback", "required": true, "type": "callback" } ] }, { "documentation": "Uploads all mp3 files in the folder provided.", "name": "UploadFolder", "parameters": [ { "documentation": "The path to upload mp3 files from.", "name": "path", "required": true, "type": "string" }, { "documentation": "The callback function for progress.", "name": "callback", "required": true, "type": "callback" } ] }, { "documentation": "Returns the server name to the current locker service.", "name": "GetLockerService", "parameters": [ ] }, { "documentation": "Changes the name of the locker service.", "name": "SetLockerService", "parameters": [ { "documentation": "The value of the locker service to set active.", "name": "LockerService", "required": true, "type": "string" } ] }, { "documentation": "Downloads locker files to the suggested folder.", "name": "DownloadFile", "parameters": [ { "documentation": "The origin path of the locker file.", "name": "path", "required": true, "type": "string" }, { "documentation": "The Window destination path of the locker file.", "name": "destination", "required": true, "type": "integer" }, { "documentation": "The callback function for progress.", "name": "callback", "required": true, "type": "callback" } ] } ], "name": "LockerUploader", "version": { "major": 0, "micro": 1, "minor": 0 }, "versionString": "0.0.1" }`,
    },
    "array of arrays": {
        text: '[ [ [ [ "foo" ] ] ] ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "openarray", "[", null],
            ["token", "openarray", "[", null],
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "foo", null],
            ["token", "closearray", "]", null],
            ["token", "closearray", "]", null],
            ["token", "closearray", "]", null],
            ["token", "closearray", "]", null],
            ["end", null],
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
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "9223372036854775808", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "floats": {
        text: '[ 0.1e2, 1e1, 3.141569, 10000000000000e-10 ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "0.1e2", null],
            ["token", "unquotedtoken", "1e1", null],
            ["token", "unquotedtoken", "3.141569", null],
            ["token", "unquotedtoken", "10000000000000e-10", null],
            ["token", "closearray", "]", null],
            ["end", null],
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
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "unquotedtoken", "0", null],
            ["token", "unquotedtoken", "-1", null],
            ["token", "unquotedtoken", "-0.3", null],
            ["token", "unquotedtoken", "0.3", null],
            ["token", "unquotedtoken", "1343.32", null],
            ["token", "unquotedtoken", "3345", null],
            ["token", "unquotedtoken", "3.1e124", null],
            ["token", "unquotedtoken", "9223372036854775807", null],
            ["token", "unquotedtoken", "-9223372036854775807", null],
            ["token", "unquotedtoken", "0.1e2", null],
            ["token", "unquotedtoken", "1e1", null],
            ["token", "unquotedtoken", "3.141569", null],
            ["token", "unquotedtoken", "10000000000000e-10", null],
            ["token", "unquotedtoken", "0.00011999999999999999", null],
            ["token", "unquotedtoken", "6E-06", null],
            ["token", "unquotedtoken", "6E-06", null],
            ["token", "unquotedtoken", "1E-06", null],
            ["token", "unquotedtoken", "1E-06", null],
            ["token", "quotedstring", "2009-10-20@20:38:21.539575", null],
            ["token", "unquotedtoken", "9223372036854775808", null],
            ["token", "unquotedtoken", "123456789", null],
            ["token", "unquotedtoken", "-123456789", null],
            ["token", "unquotedtoken", "2147483647", null],
            ["token", "unquotedtoken", "-2147483647", null],
            ["token", "closearray", "]", null],
            ["end", null],
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
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "firstName", null],
            ["token", "quotedstring", "John", null],
            ["token", "quotedstring", "lastName", null],
            ["token", "quotedstring", "Smith", null],
            ["token", "quotedstring", "age", null],
            ["token", "unquotedtoken", "25", null],
            ["token", "quotedstring", "address", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "streetAddress", null],
            ["token", "quotedstring", "21 2nd Street", null],
            ["token", "quotedstring", "city", null],
            ["token", "quotedstring", "New York", null],
            ["token", "quotedstring", "state", null],
            ["token", "quotedstring", "NY", null],
            ["token", "quotedstring", "postalCode", null],
            ["token", "quotedstring", "10021", null],
            ["token", "closeobject", "}", null],
            ["token", "quotedstring", "phoneNumber", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "home", null],
            ["token", "quotedstring", "unquotedtoken", null],
            ["token", "quotedstring", "212 555-1234", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "type", null],
            ["token", "quotedstring", "fax", null],
            ["token", "quotedstring", "unquotedtoken", null],
            ["token", "quotedstring", "646 555-4567", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["end", null],
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
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "a", null],
            ["token", "openarray", "[", null],
            ["token", "closearray", "]", null],
            ["token", "quotedstring", "c", null],
            ["token", "openobject", "{", null],
            ["token", "closeobject", "}", null],
            ["token", "quotedstring", "b", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "closeobject", "}", null],
            ["end", null],
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
            ['parsingerror', 'unexpected end of document, still in array'],
            ['parsingerror', 'unexpected end of document, still in array'],
            ["end", [1, 23]],
            ['stacked error', 'unexpected end of document, still in array'],
            ['stacked error', 'unexpected end of document, still in array'],
        ],
    },
    "incomplete json terminates ending in comma": {
        text: '[ [ 1, 2, 42 ],',
        events: [
            ["token", "openarray", "[", null],
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "unquotedtoken", "2", null],
            ["token", "unquotedtoken", "42", null],
            ["token", "closearray", "]", null],
            ['parsingerror', 'unexpected end of document, still in array'],
            ["end", null],
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
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "glossary", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "title", null],
            ["token", "quotedstring", "example glossary", null],
            ["token", "quotedstring", "GlossDiv", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "title", null],
            ["token", "quotedstring", "S", null],
            ["token", "quotedstring", "GlossList", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "GlossEntry", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "ID", null],
            ["token", "quotedstring", "SGML", null],
            ["token", "quotedstring", "SortAs", null],
            ["token", "quotedstring", "SGML", null],
            ["token", "quotedstring", "GlossTerm", null],
            ["token", "quotedstring", "Standard Generalized Markup Language", null],
            ["token", "quotedstring", "Acronym", null],
            ["token", "quotedstring", "SGML", null],
            ["token", "quotedstring", "Abbrev", null],
            ["token", "quotedstring", 'ISO 8879:1986', null],
            ["token", "quotedstring", "GlossDef", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "para", null],
            ["token", "quotedstring", 'A meta-markup language, used to create markup languages such as DocBook.', null],
            ["token", "quotedstring", "GlossSeeAlso", null],
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "GML", null],
            ["token", "quotedstring", "XML", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "quotedstring", "GlossSee", null],
            ["token", "quotedstring", "markup", null],
            ["token", "closeobject", "}", null],
            ["token", "closeobject", "}", null],
            ["token", "closeobject", "}", null],
            ["token", "closeobject", "}", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "string chunk span": {
        text: '[ "L\'OrÃ©al", "LÃ©\'Oral", "Ã©alL\'Or" ]',
        chunks: [
            '[ "L\'OrÃ',
            '©al", "LÃ©\'Oral", "Ã©alL\'Or" ]'],
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", 'L\'OrÃ©al', null],
            ["token", "quotedstring", 'LÃ©\'Oral', null],
            ["token", "quotedstring", 'Ã©alL\'Or', null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension: apostrophe string": {
        text: "'a string'",
        events: [
            ["token", "quotedstring", "a string", null],
            ["validationerror", "invalid string, should start with'\"' in strict JSON"],
            ["end", null],
        ],
    },
    "multiline string": {
        text: '[ "a\nstring" ]',
        skipRoundTripCheck: true,
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "a\nstring", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension: trailing comma": {
        text: '[ 1, 2, ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "unquotedtoken", "2", null],
            ["token", "closearray", "]", null],
            ["validationerror", "trailing commas are not allowed"],
            ["end", null],
        ],
    },
    "forbidden extension: block comment": {
        text: '[ 1, 2 /*a comment\n*/ ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "unquotedtoken", "2", null],
            ["token", "blockcomment", "a comment\n", null],
            ["validationerror", "block comments are not allowed in strict JSON"],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension parens instead of braces": {
        text: '( "a": "foo" )',
        events: [
            ["token", "openobject", "(", null],
            ["validationerror", "objects should start with '{' in strict JSON"],
            ["token", "quotedstring", "a", null],
            ["token", "quotedstring", "foo", null],
            ["token", "closeobject", ")", null],
            ["validationerror", "objects should end with '}' in strict JSON"],
            ["end", null],
        ],
    },
    "forbidden extension missing comma": {
        text: '[ "foo" "bar" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "bar", null],
            ["validationerror", "commas are required between elements in strict JSON"],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension: angle brackets instead of brackets": {
        text: '< "foo" >',
        events: [
            ["token", "openarray", "<", null],
            ["validationerror", "arrays should start with '[' in strict JSON"],
            ["token", "quotedstring", "foo", null],
            ["token", "closearray", ">", null],
            ["validationerror", "arrays should end with ']' in strict JSON"],
            ["end", null],
        ],
    },
    "forbidden extension: single line comment": {
        text: '[ 1, 2 //a comment\n]',
        skipRoundTripCheck: true,
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "unquotedtoken", "2", null],
            ["token", "linecomment", "a comment", null],
            ["validationerror", "line comments are not allowed in strict JSON"],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension: tagged union": {
        text: '| "foo" "x"',
        events: [
            ["token", "opentaggedunion", null],
            ["validationerror", "tagged unions are not allowed in strict JSON"],
            ["token", "quotedstring"/*option*/, "foo", null],
            ["token", "quotedstring", "x", null],
            //["closetaggedunion"],
            ["end", null],
        ],
    },
    "forbidden extension: schema": {
        text: '!"foo" { }',
        testHeaders: true,
        events: [
            ["token", "schema data start"],
            ["validationerror", "headers are not allowed in strict JSON"],
            ["token", "quotedstring", "foo", null],
            ["end", null],
            ["instance data start", false],
            ["token", "openobject", "{", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "unclosed object": {
        text: '{',
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "openobject", "{", null],
            ["parsingerror", "unexpected end of document, still in object"],
            ["end", null],
            ["stacked error", "unexpected end of document, still in object"],
        ],
    },
    "wrong inline formatting": {
        text: '[ "",\n""]',
        formattedText: '[ "", "" ]',
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "", null],
            ["token", "quotedstring", "", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "wrong block formatting": {
        text: '[ \n"",""]',
        formattedText: '[\n    "",\n    ""\n]',
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "", null],
            ["token", "quotedstring", "", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "trailing whitespace": {
        text: '"foo" ',
        formattedText: '"foo" ',
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "quotedstring", "foo", null],
            ["end", null],
        ],
    },
}
