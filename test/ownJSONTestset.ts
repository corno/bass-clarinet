import { TestDefinitions } from "./testDefinition";


export const JSONTests: TestDefinitions = {
    "just a string": {
        text: '"a string"',
        events: [
            ["quotedstring", "a string", 1, 10],
            ["end"],
            ["ready"],
        ],
    },
    "just a number": {
        text: '42',
        events: [
            ["number", "42"],
            ["end"],
            ["ready"],
        ],
    },
    "empty array": {
        text: '[]',
        events: [
            ["openarray", 1, 1],
            ["closearray", 1, 2],
            ["end"],
            ["ready"],
        ],
    },
    "just slash": {
        text: '["\\\\"]',
        events: [
            ["openarray"],
            ["quotedstring", "\\"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "zero byte": {
        text: '{"foo": "\\u0000"}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["quotedstring", "\u0000"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "empty value": {
        text: '{"foo": ""}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["quotedstring", ""],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "empty key": {
        text: '{"foo": "bar", "": "baz"}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["quotedstring", "bar"],
            ["key", ""],
            ["quotedstring", "baz"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "three byte utf8": {
        text: '{"matzue": "松江", "asakusa": "浅草"}',
        events: [
            ["openobject"],
            ["key", "matzue"],
            ["quotedstring", "松江"],
            ["key", "asakusa"],
            ["quotedstring", "浅草"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "four byte utf8": {
        text: '{ "U+10ABCD": "������" }',
        events: [
            ["openobject"],
            ["key", "U+10ABCD"],
            ["quotedstring", "������"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "bulgarian": {
        text: '["Да Му Еба Майката"]',
        events: [
            ["openarray"],
            ["quotedstring", "Да Му Еба Майката"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "codepoints from unicodes": {
        text: '["\\u004d\\u0430\\u4e8c\\ud800\\udf02"]',
        events: [
            ["openarray"],
            ["quotedstring", "\u004d\u0430\u4e8c\ud800\udf02"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "empty object": {
        text: '{}',
        events: [
            ["openobject"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "foobar": {
        text: '{"foo": "bar"}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["quotedstring", "bar"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "as is": {
        text: "{\"foo\": \"its \\\"as is\\\", \\\"yeah\", \"bar\": false}",
        events: [
            ["openobject"],
            ["key", "foo"],
            ["quotedstring", 'its "as is", "yeah'],
            ["key", "bar"],
            ["unquotedstring", "false"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "array": {
        text: '["one", "two"]',
        events: [
            ["openarray"],
            ["quotedstring", 'one'],
            ["quotedstring", 'two'],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "array fu": {
        text: '["foo", "bar", "baz",true,false,null,{"key":"quotedstring"},' +
            '[null,null,null,[]]," \\\\ "]',
        events: [
            ["openarray"],
            ["quotedstring", 'foo'],
            ["quotedstring", 'bar'],
            ["quotedstring", 'baz'],
            ["unquotedstring", "true"],
            ["unquotedstring", "false"],
            ["unquotedstring", "null"],
            ["openobject"],
            ["key", 'key'],
            ["quotedstring", "quotedstring"],
            ["closeobject"],
            ["openarray"],
            ["unquotedstring", "null"],
            ["unquotedstring", "null"],
            ["unquotedstring", "null"],
            ["openarray"],
            ["closearray"],
            ["closearray"],
            ["quotedstring", " \\ "],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "simple exp": {
        text: '[10e-01]',
        events: [
            ["openarray"],
            ["number", "10e-01"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "nested": {
        text: '{"a":{"b":"c"}}',
        events: [
            ["openobject"],
            ["key", "a"],
            ["openobject"],
            ["key", "b"],
            ["quotedstring", "c"],
            ["closeobject"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "nested array": {
        text: '{"a":["b", "c"]}',
        events: [
            ["openobject"],
            ["key", "a"],
            ["openarray"],
            ["quotedstring", 'b'],
            ["quotedstring", 'c'],
            ["closearray"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "array of objs": {
        text: '[{"a":"b"}, {"c":"d"}]',
        events: [
            ["openarray"],
            ["openobject"],
            ["key", "a"],
            ["quotedstring", 'b'],
            ["closeobject"],
            ["openobject"],
            ["key", "c"],
            ["quotedstring", 'd'],
            ["closeobject"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "two keys": {
        text: '{"a": "b", "c": "d"}',
        events: [
            ["openobject"],
            ["key", "a"],
            ["quotedstring", "b"],
            ["key", "c"],
            ["quotedstring", "d"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "key true": {
        text: '{"foo": true, "bar": false, "baz": null}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["unquotedstring", "true"],
            ["key", "bar"],
            ["unquotedstring", "false"],
            ["key", "baz"],
            ["unquotedstring", "null"],
            ["closeobject", 1, 40],
            ["end"],
            ["ready"],
        ],
    },
    "obj strange strings": {
        text: '{"foo": "bar and all\\\"", "bar": "its \\\"nice\\\""}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["quotedstring", 'bar and all"'],
            ["key", "bar"],
            ["quotedstring", 'its "nice"'],
            ["closeobject", 1, 47],
            ["end"],
            ["ready"],
        ],
    },
    "bad foo bar": {
        text: '["foo", "bar"',
        events: [
            ["openarray"],
            ["quotedstring", 'foo'],
            ["quotedstring", 'bar'],
            ['error'],
            //["end"],
            //["ready"],
        ],
    },
    "string invalid escape": {
        text: '["and you can\'t escape thi\s"]',
        events: [
            ["openarray", 1, 1],
            ["quotedstring", 'and you can\'t escape this', 1, 28],
            ["closearray", 1, 29],
            ["end"],
            ["ready"],
        ],
    },
    "nuts and bolts": {
        text: '{"boolean, true": true' +
            ', "boolean, false": false' +
            ', "null": null }',
        events: [
            ["openobject"],
            ["key", "boolean, true"],
            ["unquotedstring", "true"],
            ["key", "boolean, false"],
            ["unquotedstring", "false"],
            ["key", "null"],
            ["unquotedstring", "null"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "frekin string": {
        text: '["\\\\\\"\\"a\\""]',
        events: [
            ["openarray"],
            ["quotedstring", '\\\"\"a\"'],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "array of string insanity": {
        text: '["\\\"and this string has an escape at the beginning",' +
            '"and this string has no escapes"]',
        events: [
            ["openarray"],
            ["quotedstring", "\"and this string has an escape at the beginning"],
            ["quotedstring", "and this string has no escapes"],
            ["closearray"],
            ["end"],
            ["ready"],
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
            ["openobject"],
            ["key", "CoreletAPIVersion"],
            ["number", "2"],
            ["key", "CoreletType"],
            ["quotedstring", "standalone"],
            ["key", "documentation"],
            ["quotedstring", "A corelet that provides the capability to upload a folder’s contents into a user’s locker."],
            ["key", "functions"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "Displays a dialog box that allows user to select a folder on the local system."],
            ["key", "name"],
            ["quotedstring", "ShowBrowseDialog"],
            ["key", "parameters"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "The callback function for results."],
            ["key", "name"],
            ["quotedstring", "callback"],
            ["key", "required"],
            ["unquotedstring", "true"],
            ["key", "type"],
            ["quotedstring", "callback"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "Uploads all mp3 files in the folder provided."],
            ["key", "name"],
            ["quotedstring", "UploadFolder"],
            ["key", "parameters"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "The path to upload mp3 files from."],
            ["key", "name"],
            ["quotedstring", "path"],
            ["key", "required"],
            ["unquotedstring", "true"],
            ["key", "type"],
            ["quotedstring", "string"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "The callback function for progress."],
            ["key", "name"],
            ["quotedstring", "callback"],
            ["key", "required"],
            ["unquotedstring", "true"],
            ["key", "type"],
            ["quotedstring", "callback"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "Returns the server name to the current locker service."],
            ["key", "name"],
            ["quotedstring", "GetLockerService"],
            ["key", "parameters"],
            ["openarray"],
            ["closearray"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "Changes the name of the locker service."],
            ["key", "name"],
            ["quotedstring", "SetLockerService"],
            ["key", "parameters"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "The value of the locker service to set active."],
            ["key", "name"],
            ["quotedstring", "LockerService"],
            ["key", "required"],
            ["unquotedstring", "true"],
            ["key", "type"],
            ["quotedstring", "string"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "Downloads locker files to the suggested folder."],
            ["key", "name"],
            ["quotedstring", "DownloadFile"],
            ["key", "parameters"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "The origin path of the locker file."],
            ["key", "name"],
            ["quotedstring", "path"],
            ["key", "required"],
            ["unquotedstring", "true"],
            ["key", "type"],
            ["quotedstring", "string"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "The Window destination path of the locker file."],
            ["key", "name"],
            ["quotedstring", "destination"],
            ["key", "required"],
            ["unquotedstring", "true"],
            ["key", "type"],
            ["quotedstring", "integer"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["quotedstring", "The callback function for progress."],
            ["key", "name"],
            ["quotedstring", "callback"],
            ["key", "required"],
            ["unquotedstring", "true"],
            ["key", "type"],
            ["quotedstring", "callback"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["closearray"],
            ["key", "name"],
            ["quotedstring", "LockerUploader"],
            ["key", "version"],
            ["openobject"],
            ["key", "major"],
            ["number", "0"],
            ["key", "micro"],
            ["number", "1"],
            ["key", "minor"],
            ["number", "0"],
            ["closeobject"],
            ["key", "versionString"],
            ["quotedstring", "0.0.1"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "array of arrays": {
        text: '[[[["foo"]]]]',
        events: [
            ["openarray"],
            ["openarray"],
            ["openarray"],
            ["openarray"],
            ["quotedstring", "foo"],
            ["closearray"],
            ["closearray"],
            ["closearray"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "low overflow": {
        text: '[-9223372036854775808]',
        chunks: [
            '[-92233720',
            '36854775808]'],
        events: [
            ["openarray"],
            ["number", "-9223372036854775808"],
            ["closearray", 1, 22],
            ["end"],
            ["ready"],
        ],
    },
    "high overflow": {
        text: '[9223372036854775808]',
        events: [
            ["openarray"],
            ["number", "9223372036854775808"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "floats": {
        text: '[0.1e2, 1e1, 3.141569, 10000000000000e-10]',
        events: [
            ["openarray"],
            ["number", "0.1e2"],
            ["number", "1e1"],
            ["number", "3.141569"],
            ["number", "10000000000000e-10"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "numbers game": {
        text: '[1,0,-1,-0.3,0.3,1343.32,3345,3.1e124,' +
            ' 9223372036854775807,-9223372036854775807,0.1e2, ' +
            '1e1, 3.141569, 10000000000000e-10,' +
            '0.00011999999999999999, 6E-06, 6E-06, 1E-06, 1E-06,' +
            '"2009-10-20@20:38:21.539575", 9223372036854775808,' +
            '123456789,-123456789,' +
            '2147483647, -2147483647]',
        events: [
            ["openarray"],
            ["number", "1"],
            ["number", "0"],
            ["number", "-1"],
            ["number", "-0.3"],
            ["number", "0.3"],
            ["number", "1343.32"],
            ["number", "3345"],
            ["number", "3.1e124"],
            ["number", "9223372036854775807"],
            ["number", "-9223372036854775807"],
            ["number", "0.1e2"],
            ["number", "1e1"],
            ["number", "3.141569"],
            ["number", "10000000000000e-10"],
            ["number", "0.00011999999999999999"],
            ["number", "6E-06"],
            ["number", "6E-06"],
            ["number", "1E-06"],
            ["number", "1E-06"],
            ["quotedstring", "2009-10-20@20:38:21.539575"],
            ["number", "9223372036854775808"],
            ["number", "123456789"],
            ["number", "-123456789"],
            ["number", "2147483647"],
            ["number", "-2147483647"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "johnsmith": {
        text: '{ "firstName": "John", "lastName" : "Smith", "age" : ' +
            '25, "address" : { "streetAddress": "21 2nd Street", ' +
            '"city" : "New York", "state" : "NY", "postalCode" : ' +
            ' "10021" }, "phoneNumber": [ { "type" : "home", ' +
            '"number": "212 555-1234" }, { "type" : "fax", ' +
            '"number": "646 555-4567" } ] }',
        events: [
            ["openobject"],
            ["key", "firstName"],
            ["quotedstring", "John"],
            ["key", "lastName"],
            ["quotedstring", "Smith"],
            ["key", "age"],
            ["number", "25"],
            ["key", "address"],
            ["openobject"],
            ["key", "streetAddress"],
            ["quotedstring", "21 2nd Street"],
            ["key", "city"],
            ["quotedstring", "New York"],
            ["key", "state"],
            ["quotedstring", "NY"],
            ["key", "postalCode"],
            ["quotedstring", "10021"],
            ["closeobject"],
            ["key", "phoneNumber"],
            ["openarray"],
            ["openobject"],
            ["key", "type"],
            ["quotedstring", "home"],
            ["key", "number"],
            ["quotedstring", "212 555-1234"],
            ["closeobject"],
            ["openobject"],
            ["key", "type"],
            ["quotedstring", "fax"],
            ["key", "number"],
            ["quotedstring", "646 555-4567"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "array null": {
        text: '[null,false,true]',
        chunks: [
            '[nu',
            'll,',
            'fa',
            'lse,',
            'tr',
            'ue]'],
        events: [
            ["openarray", 1, 1],
            ["unquotedstring", "null", 1, 5],
            ["unquotedstring", "false", 1, 11],
            ["unquotedstring", "true", 1, 16],
            ["closearray", 1, 17],
            ["end"],
            ["ready"],
        ],
    },
    "empty array comma": {
        text: '{"a":[],"c": {}, "b": true}',
        events: [
            ["openobject", 1, 1],
            ["key", "a"],
            ["openarray", 1, 6],
            ["closearray", 1, 7],
            ["key", "c"],
            ["openobject"],
            ["closeobject"],
            ["key", "b"],
            ["unquotedstring", "true"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "incomplete json terminates ending in number": {
        text: '[[1,2,3],[42,0',
        events: [
            ["openarray", 1, 1],
            ["openarray", 1, 2],
            ["number", "1", 1, 3],
            ["number", "2", 1, 5],
            ["number", "3", 1, 7],
            ["closearray", 1, 8],
            ["openarray", 1, 10],
            ["number", "42", 1, 12],
            ["number", "0"],
            ['error'],
        ],
    },
    "incomplete json terminates ending in comma": {
        text: '[[1,2,42],',
        events: [
            ["openarray"],
            ["openarray"],
            ["number", "1"],
            ["number", "2"],
            ["number", "42"],
            ["closearray"],
            ['error'],
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
            '            \t\t\t\t\t\t"GlossSeeAlso": ["GML", "XML"]\r\n' +
            '                                                    },\r\n' +
            '            \t\t\t\t\t"GlossSee": "markup"\r\n' +
            '                                            }\r\n' +
            '                                    }\r\n' +
            '                            }\r\n' +
            '                    }\r\n' +
            '            }\r\n'),
        events: [
            ["openobject"],
            ["key", "glossary"],
            ["openobject"],
            ["key", "title"],
            ["quotedstring", "example glossary"],
            ["key", "GlossDiv"],
            ["openobject"],
            ["key", "title"],
            ["quotedstring", "S"],
            ["key", "GlossList"],
            ["openobject"],
            ["key", "GlossEntry"],
            ["openobject"],
            ["key", "ID"],
            ["quotedstring", "SGML"],
            ["key", "SortAs"],
            ["quotedstring", "SGML"],
            ["key", "GlossTerm"],
            ["quotedstring", "Standard Generalized Markup Language"],
            ["key", "Acronym"],
            ["quotedstring", "SGML"],
            ["key", "Abbrev"],
            ["quotedstring", 'ISO 8879:1986'],
            ["key", "GlossDef"],
            ["openobject"],
            ["key", "para"],
            ["quotedstring", 'A meta-markup language, used to create markup languages such as DocBook.'],
            ["key", "GlossSeeAlso"],
            ["openarray"],
            ["quotedstring", "GML"],
            ["quotedstring", "XML"],
            ["closearray"],
            ["closeobject"],
            ["key", "GlossSee"],
            ["quotedstring", "markup"],
            ["closeobject"],
            ["closeobject"],
            ["closeobject"],
            ["closeobject"],
            ["closeobject"],
            ["end"],
            ["ready"],
        ],
    },
    "string chunk span": {
        text: '["L\'OrÃ©al", "LÃ©\'Oral", "Ã©alL\'Or"]',
        chunks: [
            '["L\'OrÃ',
            '©al", "LÃ©\'Oral", "Ã©alL\'Or"]'],
        events: [
            ["openarray"],
            ["quotedstring", 'L\'OrÃ©al'],
            ["quotedstring", 'LÃ©\'Oral'],
            ["quotedstring", 'Ã©alL\'Or'],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "forbidden extension apostrophe string": {
        text: "'a string'",
        events: [
            ["error"],
        ],
    },
    "multiline string": {
        text: '["a\nstring"]',
        events: [
            ["openarray"],
            ["quotedstring", "a\nstring"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "forbidden extension trailing comma": {
        text: '[1,2,]',
        events: [
            ["openarray"],
            ["number", "1"],
            ["number", "2"],
            ["error"],
        ],
    },
    "forbidden extension multi line comment": {
        text: '[1,2/*a comment\r\n*/]',
        events: [
            ["openarray"],
            ["number", "1"],
            ["number", "2"],
            ["error"],
        ],
    },
    "forbidden extension parens instead of braces": {
        text: '( a: "foo" )',
        options: {
        },
        events: [
            ["error"],
        ],
    },
    "forbidden extension missing comma": {
        text: '["foo""bar"]',
        options: {
        },
        events: [
            ["openarray"],
            ["quotedstring", "foo"],
            ["error"],
        ],
    },
    "forbidden extension angle brackets instead of brackets": {
        text: '<"foo">',
        options: {
        },
        events: [
            ["error"],
        ],
    },
    "forbidden extension single line comment": {
        text: '[1,2//a comment\r\n]',
        events: [
            ["openarray"],
            ["number", "1"],
            ["number", "2"],
            ["error"],
        ],
    },
    "forbidden tagged union": {
        text: '| "foo", {}',
        events: [
            ["error"],
        ],
    },
}
