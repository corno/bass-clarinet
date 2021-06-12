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
            ["token", "simple string", "a string", [1, 1, 1, 11]],
            ["end", [1, 11]],
        ],
    },
    "unterminated string": {
        text: '"an unterminated string',
        testForLocation: true,
        events: [
            ["parsingerror", "unterminated string"],
            ["token", "simple string", "an unterminated string", [1, 1, 1, 24]],
            ["end", [1, 24]],
        ],
    },
    "newline": {
        text: '\n  "a string after a newline"',
        skipRoundTripCheck: true,
        testForLocation: true,
        events: [
            ["token", "simple string", "a string after a newline", [2, 3, 2, 29]],
            ["end", [2, 29]],
        ],
        formattedText: '\n  "a string after a newline"',
    },
    "just a number": {
        text: '42',
        testForLocation: true,
        events: [
            ["token", "simple string", "42", [1, 1, 1, 3]],
            ["end", [1, 3]],
        ],
    },
    "invalid number": {
        text: '42x',
        events: [
            ["token", "simple string", "42x", null],
            //["validationerror", "Invalid number, unexpected character x in '42x'"],
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
            ["token", "simple string", "\\", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "zero byte": {
        text: '{ "foo": "\\u0000" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "foo", null],
            ["token", "simple string", "\u0000", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "empty value": {
        text: '{ "foo": "" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "foo", null],
            ["token", "simple string", "", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "empty key": {
        text: '{ "foo": "bar", "": "baz" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "foo", null],
            ["token", "simple string", "bar", null],
            ["token", "simple string", "", null],
            ["token", "simple string", "baz", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "invalid key": {
        text: '{ "foo": "bar", { }: "baz" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "foo", null],
            ["token", "simple string", "bar", null],
            ["token", "openobject", "{", null],
            //["validationerror", "expected key or object end"],
            ["token", "closeobject", "}", null],
            //["validationerror", "did not expect a colon"],
            ["token", "simple string", "baz", null],
            ["token", "closeobject", "}", null],
            ["stacked error", "missing value"],
            ["parsingerror", "missing property value"],
            ["end", null],
        ],
    },
    "three byte utf8": {
        text: '{ "matzue": "松江", "asakusa": "浅草" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "matzue", null],
            ["token", "simple string", "松江", null],
            ["token", "simple string", "asakusa", null],
            ["token", "simple string", "浅草", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "four byte utf8": {
        text: '{ "U+10ABCD": "������" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "U+10ABCD", null],
            ["token", "simple string", "������", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "bulgarian": {
        text: '[ "Да Му Еба Майката" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "Да Му Еба Майката", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "codepoints from unicodes": {
        text: '[ "\\u004d\\u0430\\u4e8c\\ud800\\udf02" ]',
        skipRoundTripCheck: true,
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "\u004d\u0430\u4e8c\ud800\udf02", null],
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
            ["token", "simple string", "foo", null],
            ["token", "closeobject", "}", null],
            ["stacked error", "missing value"],
            ["parsingerror", "missing property value"],
            ["end", null],
        ],
    },
    "foobar": {
        text: '{ "foo": "bar" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "foo", null],
            ["token", "simple string", "bar", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "as is": {
        text: "{ \"foo\": \"its \\\"as is\\\", \\\"yeah\", \"bar\": false }",
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "foo", null],
            ["token", "simple string", 'its "as is", "yeah', null],
            ["token", "simple string", "bar", null],
            ["token", "simple string", "false", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "array": {
        text: '[ "one", "two" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", 'one', null],
            ["token", "simple string", 'two', null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "array fu": {
        text: '[ "foo", "bar", "baz", true, false, null, { "key": "simple string" }, ' +
            '[ null, null, null, [ ] ], " \\\\ " ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", 'foo', null],
            ["token", "simple string", 'bar', null],
            ["token", "simple string", 'baz', null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "false", null],
            ["token", "simple string", "null", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", 'key', null],
            ["token", "simple string", "simple string", null],
            ["token", "closeobject", "}", null],
            ["token", "openarray", "[", null],
            ["token", "simple string", "null", null],
            ["token", "simple string", "null", null],
            ["token", "simple string", "null", null],
            ["token", "openarray", "[", null],
            ["token", "closearray", "]", null],
            ["token", "closearray", "]", null],
            ["token", "simple string", " \\ ", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "simple exp": {
        text: '[ 10e-01 ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "10e-01", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "nested": {
        text: '{ "a": { "b": "c" } }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "a", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "b", null],
            ["token", "simple string", "c", null],
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
            ["token", "simple string", "a", null],
            ["token", "openarray", "[", null],
            ["token", "simple string", 'b', null],
            ["token", "simple string", 'c', null],
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
            ["token", "simple string", "a", null],
            ["token", "simple string", 'b', null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "c", null],
            ["token", "simple string", 'd', null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "two keys": {
        text: '{ "a": "b", "c": "d" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "a", null],
            ["token", "simple string", "b", null],
            ["token", "simple string", "c", null],
            ["token", "simple string", "d", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "key true": {
        text: '{ "foo": true, "bar": false, "baz": null }',
        testForLocation: true,
        events: [
            ["token", "openobject", "{", [1, 1, 1, 2]],
            ["token", "simple string", "foo", [1, 3, 1, 8]],
            ["token", "simple string", "true", [1, 10, 1, 14]],
            ["token", "simple string", "bar", [1, 16, 1, 21]],
            ["token", "simple string", "false", [1, 23, 1, 28]],
            ["token", "simple string", "baz", [1, 30, 1, 35]],
            ["token", "simple string", "null", [1, 37, 1, 41]],
            ["token", "closeobject", "}", [1, 42, 1, 43]],
            ["end", [1, 43]],
        ],
    },
    "obj strange strings": {
        text: '{ "foo": "bar and all\\\"", "bar": "its \\\"nice\\\"" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "foo", null],
            ["token", "simple string", 'bar and all"', null],
            ["token", "simple string", "bar", null],
            ["token", "simple string", 'its "nice"', null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "bad foo bar": {
        text: '[ "foo", "bar"',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", 'foo', null],
            ["token", "simple string", 'bar', null],
            ['parsingerror', 'unexpected end of text, still in array'],
            ["end", null],
            ['stacked error', 'unexpected end of text, still in array'],
        ],
    },
    "string invalid escape": {
        text: '[ "and you can\'t escape thi\s" ]',
        testForLocation: true,
        events: [
            ["token", "openarray", "[", [1, 1, 1, 2]],
            ["token", "simple string", 'and you can\'t escape this', [1, 3, 1, 30]],
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
            ["token", "simple string", "boolean, true", null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "boolean, false", null],
            ["token", "simple string", "false", null],
            ["token", "simple string", "null", null],
            ["token", "simple string", "null", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "frekin string": {
        text: '[ "\\\\\\"\\"a\\"" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", '\\\"\"a\"', null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "array of string insanity": {
        text: '[ "\\\"and this string has an escape at the beginning", ' +
            '"and this string has no escapes" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "\"and this string has an escape at the beginning", null],
            ["token", "simple string", "and this string has no escapes", null],
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
            ["token", "simple string", "CoreletAPIVersion", null],
            ["token", "simple string", "2", null],
            ["token", "simple string", "CoreletType", null],
            ["token", "simple string", "standalone", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "A corelet that provides the capability to upload a folder’s contents into a user’s locker.", null],
            ["token", "simple string", "functions", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "Displays a dialog box that allows user to select a folder on the local system.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "ShowBrowseDialog", null],
            ["token", "simple string", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "The callback function for results.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "callback", null],
            ["token", "simple string", "required", null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "callback", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "Uploads all mp3 files in the folder provided.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "UploadFolder", null],
            ["token", "simple string", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "The path to upload mp3 files from.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "path", null],
            ["token", "simple string", "required", null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "string", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "The callback function for progress.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "callback", null],
            ["token", "simple string", "required", null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "callback", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "Returns the server name to the current locker service.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "GetLockerService", null],
            ["token", "simple string", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "Changes the name of the locker service.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "SetLockerService", null],
            ["token", "simple string", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "The value of the locker service to set active.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "LockerService", null],
            ["token", "simple string", "required", null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "string", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "Downloads locker files to the suggested folder.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "DownloadFile", null],
            ["token", "simple string", "parameters", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "The origin path of the locker file.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "path", null],
            ["token", "simple string", "required", null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "string", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "The Window destination path of the locker file.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "destination", null],
            ["token", "simple string", "required", null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "integer", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "documentation", null],
            ["token", "simple string", "The callback function for progress.", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "callback", null],
            ["token", "simple string", "required", null],
            ["token", "simple string", "true", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "callback", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "closearray", "]", null],
            ["token", "simple string", "name", null],
            ["token", "simple string", "LockerUploader", null],
            ["token", "simple string", "version", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "major", null],
            ["token", "simple string", "0", null],
            ["token", "simple string", "micro", null],
            ["token", "simple string", "1", null],
            ["token", "simple string", "minor", null],
            ["token", "simple string", "0", null],
            ["token", "closeobject", "}", null],
            ["token", "simple string", "versionString", null],
            ["token", "simple string", "0.0.1", null],
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
            ["token", "simple string", "foo", null],
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
            ["token", "simple string", "-9223372036854775808", [1, 3, 1, 23]],
            ["token", "closearray", "]", [1, 24, 1, 25]],
            ["end", [1, 25]],
        ],
    },
    "high overflow": {
        text: '[ 9223372036854775808 ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "9223372036854775808", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "floats": {
        text: '[ 0.1e2, 1e1, 3.141569, 10000000000000e-10 ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "0.1e2", null],
            ["token", "simple string", "1e1", null],
            ["token", "simple string", "3.141569", null],
            ["token", "simple string", "10000000000000e-10", null],
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
            ["token", "simple string", "1", null],
            ["token", "simple string", "0", null],
            ["token", "simple string", "-1", null],
            ["token", "simple string", "-0.3", null],
            ["token", "simple string", "0.3", null],
            ["token", "simple string", "1343.32", null],
            ["token", "simple string", "3345", null],
            ["token", "simple string", "3.1e124", null],
            ["token", "simple string", "9223372036854775807", null],
            ["token", "simple string", "-9223372036854775807", null],
            ["token", "simple string", "0.1e2", null],
            ["token", "simple string", "1e1", null],
            ["token", "simple string", "3.141569", null],
            ["token", "simple string", "10000000000000e-10", null],
            ["token", "simple string", "0.00011999999999999999", null],
            ["token", "simple string", "6E-06", null],
            ["token", "simple string", "6E-06", null],
            ["token", "simple string", "1E-06", null],
            ["token", "simple string", "1E-06", null],
            ["token", "simple string", "2009-10-20@20:38:21.539575", null],
            ["token", "simple string", "9223372036854775808", null],
            ["token", "simple string", "123456789", null],
            ["token", "simple string", "-123456789", null],
            ["token", "simple string", "2147483647", null],
            ["token", "simple string", "-2147483647", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "johnsmith": {
        text: '{ "firstName": "John", "lastName": "Smith", "age": ' +
            '25, "address": { "streetAddress": "21 2nd Street", ' +
            '"city": "New York", "state": "NY", "postalCode": ' +
            '"10021" }, "phoneNumber": [ { "type": "home", ' +
            '"simple string": "212 555-1234" }, { "type": "fax", ' +
            '"simple string": "646 555-4567" } ] }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "firstName", null],
            ["token", "simple string", "John", null],
            ["token", "simple string", "lastName", null],
            ["token", "simple string", "Smith", null],
            ["token", "simple string", "age", null],
            ["token", "simple string", "25", null],
            ["token", "simple string", "address", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "streetAddress", null],
            ["token", "simple string", "21 2nd Street", null],
            ["token", "simple string", "city", null],
            ["token", "simple string", "New York", null],
            ["token", "simple string", "state", null],
            ["token", "simple string", "NY", null],
            ["token", "simple string", "postalCode", null],
            ["token", "simple string", "10021", null],
            ["token", "closeobject", "}", null],
            ["token", "simple string", "phoneNumber", null],
            ["token", "openarray", "[", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "home", null],
            ["token", "simple string", "simple string", null],
            ["token", "simple string", "212 555-1234", null],
            ["token", "closeobject", "}", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "type", null],
            ["token", "simple string", "fax", null],
            ["token", "simple string", "simple string", null],
            ["token", "simple string", "646 555-4567", null],
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
            ["token", "simple string", "null", [1, 3, 1, 7]],
            ["token", "simple string", "false", [1, 9, 1, 14]],
            ["token", "simple string", "true", [1, 16, 1, 20]],
            ["token", "closearray", "]", [1, 21, 1, 22]],
            ["end", [1, 22]],
        ],
    },
    "empty array comma": {
        text: '{ "a": [ ], "c": { }, "b": true }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "simple string", "a", null],
            ["token", "openarray", "[", null],
            ["token", "closearray", "]", null],
            ["token", "simple string", "c", null],
            ["token", "openobject", "{", null],
            ["token", "closeobject", "}", null],
            ["token", "simple string", "b", null],
            ["token", "simple string", "true", null],
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
            ["token", "simple string", "1", [1, 5, 1, 6]],
            ["token", "simple string", "2", [1, 8, 1, 9]],
            ["token", "simple string", "3", [1, 11, 1, 12]],
            ["token", "closearray", "]", [1, 13, 1, 14]],
            ["token", "openarray", "[", [1, 16, 1, 17]],
            ["token", "simple string", "42", [1, 18, 1, 20]],
            ["token", "simple string", "0", [1, 22, 1, 23]],
            ['parsingerror', 'unexpected end of text, still in array'],
            ['parsingerror', 'unexpected end of text, still in array'],
            ["end", [1, 23]],
            ['stacked error', 'unexpected end of text, still in array'],
            ['stacked error', 'unexpected end of text, still in array'],
        ],
    },
    "incomplete json terminates ending in comma": {
        text: '[ [ 1, 2, 42 ],',
        events: [
            ["token", "openarray", "[", null],
            ["token", "openarray", "[", null],
            ["token", "simple string", "1", null],
            ["token", "simple string", "2", null],
            ["token", "simple string", "42", null],
            ["token", "closearray", "]", null],
            ['parsingerror', 'unexpected end of text, still in array'],
            ["end", null],
            ['stacked error', 'unexpected end of text, still in array'],
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
            ["token", "simple string", "glossary", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "title", null],
            ["token", "simple string", "example glossary", null],
            ["token", "simple string", "GlossDiv", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "title", null],
            ["token", "simple string", "S", null],
            ["token", "simple string", "GlossList", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "GlossEntry", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "ID", null],
            ["token", "simple string", "SGML", null],
            ["token", "simple string", "SortAs", null],
            ["token", "simple string", "SGML", null],
            ["token", "simple string", "GlossTerm", null],
            ["token", "simple string", "Standard Generalized Markup Language", null],
            ["token", "simple string", "Acronym", null],
            ["token", "simple string", "SGML", null],
            ["token", "simple string", "Abbrev", null],
            ["token", "simple string", 'ISO 8879:1986', null],
            ["token", "simple string", "GlossDef", null],
            ["token", "openobject", "{", null],
            ["token", "simple string", "para", null],
            ["token", "simple string", 'A meta-markup language, used to create markup languages such as DocBook.', null],
            ["token", "simple string", "GlossSeeAlso", null],
            ["token", "openarray", "[", null],
            ["token", "simple string", "GML", null],
            ["token", "simple string", "XML", null],
            ["token", "closearray", "]", null],
            ["token", "closeobject", "}", null],
            ["token", "simple string", "GlossSee", null],
            ["token", "simple string", "markup", null],
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
            ["token", "simple string", 'L\'OrÃ©al', null],
            ["token", "simple string", 'LÃ©\'Oral', null],
            ["token", "simple string", 'Ã©alL\'Or', null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension: apostrophe string": {
        text: "'a string'",
        events: [
            ["token", "simple string", "a string", null],
            //["validationerror", "invalid string, should start with'\"' in strict JSON"],
            ["end", null],
        ],
    },
    "quoted string with newline": {
        text: '"a\n',
        skipRoundTripCheck: true,
        events: [
            ["parsingerror", "unterminated string"],
            ["token", "simple string", "a", null],
            ["end", null],
        ],
    },
    "forbidden extension: trailing comma": {
        text: '[ 1, 2, ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "1", null],
            ["token", "simple string", "2", null],
            ["token", "closearray", "]", null],
            //["validationerror", "trailing commas are not allowed"],
            ["end", null],
        ],
    },
    "forbidden extension: block comment": {
        text: '[ 1, 2 /*a comment\n*/ ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "1", null],
            ["token", "simple string", "2", null],
            //["token", "blockcomment", "a comment\n", null],
            //["validationerror", "block comments are not allowed in strict JSON"],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension parens instead of braces": {
        text: '( "a": "foo" )',
        events: [
            ["token", "openobject", "(", null],
            //["validationerror", "objects should start with '{' in strict JSON"],
            ["token", "simple string", "a", null],
            ["token", "simple string", "foo", null],
            ["token", "closeobject", ")", null],
            //["validationerror", "objects should end with '}' in strict JSON"],
            ["end", null],
        ],
    },
    "forbidden extension missing comma": {
        text: '[ "foo" "bar" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "foo", null],
            ["token", "simple string", "bar", null],
            //["validationerror", "commas are required between elements in strict JSON"],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension: angle brackets instead of brackets": {
        text: '< "foo" >',
        events: [
            ["token", "openarray", "<", null],
            //["validationerror", "arrays should start with '[' in strict JSON"],
            ["token", "simple string", "foo", null],
            ["token", "closearray", ">", null],
            //["validationerror", "arrays should end with ']' in strict JSON"],
            ["end", null],
        ],
    },
    "forbidden extension: single line comment": {
        text: '[ 1, 2 //a comment\n]',
        skipRoundTripCheck: true,
        events: [
            ["token", "openarray", "[", null],
            ["token", "simple string", "1", null],
            ["token", "simple string", "2", null],
            //["token", "linecomment", "a comment", null],
            //["validationerror", "line comments are not allowed in strict JSON"],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "forbidden extension: tagged union": {
        text: '| "foo" "x"',
        events: [
            ["token", "opentaggedunion", null],
            //["validationerror", "tagged unions are not allowed in strict JSON"],
            ["token", "simple string"/*option*/, "foo", null],
            ["token", "simple string", "x", null],
            //["closetaggedunion"],
            ["end", null],
        ],
    },
    "forbidden extension: schema": {
        text: '!"foo" { }',
        testHeaders: true,
        events: [
            ["token", "schema data start"],
            //["validationerror", "headers are not allowed in strict JSON"],
            ["token", "simple string", "foo", null],
            ["end", null],
            ["instance data start"],
            ["token", "openobject", "{", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "unclosed object": {
        text: '{',
        testHeaders: true,
        events: [
            ["instance data start"],
            ["token", "openobject", "{", null],
            ["parsingerror", "unexpected end of text, still in object"],
            ["end", null],
            ["stacked error", "unexpected end of text, still in object"],
        ],
    },
    "wrong inline formatting": {
        text: '[ "",\n""]',
        formattedText: '[ "", "" ]',
        testHeaders: true,
        events: [
            ["instance data start"],
            ["token", "openarray", "[", null],
            ["token", "simple string", "", null],
            ["token", "simple string", "", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "wrong block formatting": {
        text: '[ \n"",""]',
        formattedText: '[\n    "",\n    "" ]',
        testHeaders: true,
        events: [
            ["instance data start"],
            ["token", "openarray", "[", null],
            ["token", "simple string", "", null],
            ["token", "simple string", "", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "trailing whitespace": {
        text: '"foo" ',
        formattedText: '"foo" ',
        testHeaders: true,
        events: [
            ["instance data start"],
            ["token", "simple string", "foo", null],
            ["end", null],
        ],
    },
}
