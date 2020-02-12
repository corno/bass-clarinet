import { TestDefinitions } from "./testDefinition";


export const JSONTests: TestDefinitions = {
    just_a_string: {
        text: '"a string"',
        events: [
            ["simplevalue", "a string", 1, 10],
            ["end", undefined],
            ["ready", undefined],
        ],
    },
    just_a_number: {
        text: '42',
        events: [
            ["simplevalue", 42],
            ["end", undefined],
            ["ready", undefined],
        ],
    },
    empty_array: {
        text: '[]',
        events: [
            ["openarray", undefined, 1, 1],
            ["closearray", undefined, 1, 2],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    just_slash: {
        text: '["\\\\"]',
        events: [
            ["openarray", undefined],
            ["simplevalue", "\\"],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    zero_byte: {
        text: '{"foo": "\\u0000"}',
        events: [
            ["openobject", undefined],
            ["key", "foo"],
            ["simplevalue", "\u0000"],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    empty_value: {
        text: '{"foo": ""}',
        events: [
            ["openobject", undefined],
            ["key", "foo"],
            ["simplevalue", ""],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    empty_key: {
        text: '{"foo": "bar", "": "baz"}',
        events: [
            ["openobject", undefined],
            ["key", "foo"],
            ["simplevalue", "bar"],
            ["key", ""],
            ["simplevalue", "baz"],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    three_byte_utf8: {
        text: '{"matzue": "松江", "asakusa": "浅草"}',
        events: [
            ["openobject", undefined],
            ["key", "matzue"],
            ["simplevalue", "松江"],
            ["key", "asakusa"],
            ["simplevalue", "浅草"],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    four_byte_utf8: {
        text: '{ "U+10ABCD": "������" }',
        events: [
            ["openobject", undefined],
            ["key", "U+10ABCD"],
            ["simplevalue", "������"],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    bulgarian: {
        text: '["Да Му Еба Майката"]',
        events: [
            ["openarray", undefined],
            ["simplevalue", "Да Му Еба Майката"],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    codepoints_from_unicodes: {
        text: '["\\u004d\\u0430\\u4e8c\\ud800\\udf02"]',
        events: [
            ["openarray", undefined],
            ["simplevalue", "\u004d\u0430\u4e8c\ud800\udf02"],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    empty_object: {
        text: '{}',
        events: [
            ["openobject", undefined],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    foobar: {
        text: '{"foo": "bar"}',
        events: [
            ["openobject", undefined],
            ["key", "foo"],
            ["simplevalue", "bar"],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    as_is: {
        text: "{\"foo\": \"its \\\"as is\\\", \\\"yeah\", \"bar\": false}",
        events: [
            ["openobject", undefined],
            ["key", "foo"],
            ["simplevalue", 'its "as is", "yeah'],
            ["key", "bar"],
            ["simplevalue", false],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    array: {
        text: '["one", "two"]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 'one'],
            ["simplevalue", 'two'],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    array_fu: {
        text: '["foo", "bar", "baz",true,false,null,{"key":"simplevalue"},' + '[null,null,null,[]]," \\\\ "]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 'foo'],
            ["simplevalue", 'bar'],
            ["simplevalue", 'baz'],
            ["simplevalue", true],
            ["simplevalue", false],
            ["simplevalue", null],
            ["openobject", undefined],
            ["key", 'key'],
            ["simplevalue", "simplevalue"],
            ["closeobject", undefined],
            ["openarray", undefined],
            ["simplevalue", null],
            ["simplevalue", null],
            ["simplevalue", null],
            ["openarray", undefined],
            ["closearray", undefined],
            ["closearray", undefined],
            ["simplevalue", " \\ "],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    simple_exp: {
        text: '[10e-01]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 10e-01],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    nested: {
        text: '{"a":{"b":"c"}}',
        events: [
            ["openobject", undefined],
            ["key", "a"],
            ["openobject", undefined],
            ["key", "b"],
            ["simplevalue", "c"],
            ["closeobject", undefined],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    nested_array: {
        text: '{"a":["b", "c"]}',
        events: [
            ["openobject", undefined],
            ["key", "a"],
            ["openarray", undefined],
            ["simplevalue", 'b'],
            ["simplevalue", 'c'],
            ["closearray", undefined],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    array_of_objs: {
        text: '[{"a":"b"}, {"c":"d"}]',
        events: [
            ["openarray", undefined],
            ["openobject", undefined],
            ["key", "a"],
            ["simplevalue", 'b'],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "c"],
            ["simplevalue", 'd'],
            ["closeobject", undefined],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    two_keys: {
        text: '{"a": "b", "c": "d"}',
        events: [
            ["openobject", undefined],
            ["key", "a"],
            ["simplevalue", "b"],
            ["key", "c"],
            ["simplevalue", "d"],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    key_true: {
        text: '{"foo": true, "bar": false, "baz": null}',
        events: [
            ["openobject", undefined],
            ["key", "foo"],
            ["simplevalue", true],
            ["key", "bar"],
            ["simplevalue", false],
            ["key", "baz"],
            ["simplevalue", null],
            ["closeobject", undefined, 1, 40],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    obj_strange_strings: {
        text: '{"foo": "bar and all\\\"", "bar": "its \\\"nice\\\""}',
        events: [
            ["openobject", undefined],
            ["key", "foo"],
            ["simplevalue", 'bar and all"'],
            ["key", "bar"],
            ["simplevalue", 'its "nice"'],
            ["closeobject", undefined, 1, 47],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    bad_foo_bar: {
        text: '["foo", "bar"',
        events: [
            ["openarray", undefined],
            ["simplevalue", 'foo'],
            ["simplevalue", 'bar'],
            ['error', undefined],
            //["end", undefined],
            //["ready", undefined]
        ]
    },
    string_invalid_escape: {
        text: '["and you can\'t escape thi\s"]',
        events: [
            ["openarray", undefined, 1, 1],
            ["simplevalue", 'and you can\'t escape this', 1, 28],
            ["closearray", undefined, 1, 29],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    nuts_and_bolts: {
        text: '{"boolean, true": true' + ', "boolean, false": false' + ', "null": null }',
        events: [
            ["openobject", undefined],
            ["key", "boolean, true"],
            ["simplevalue", true],
            ["key", "boolean, false"],
            ["simplevalue", false],
            ["key", "null"],
            ["simplevalue", null],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    frekin_string: {
        text: '["\\\\\\"\\"a\\""]',
        events: [
            ["openarray", undefined],
            ["simplevalue", '\\\"\"a\"'],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    array_of_string_insanity: {
        text: '["\\\"and this string has an escape at the beginning",' + '"and this string has no escapes"]',
        events: [
            ["openarray", undefined],
            ["simplevalue", "\"and this string has an escape at the beginning"],
            ["simplevalue", "and this string has no escapes"],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    non_utf8: {
        text: '{"CoreletAPIVersion":2,"CoreletType":"standalone",' + '"documentation":"A corelet that provides the capability to upload' + ' a folder’s contents into a user’s locker.","functions":[' + '{"documentation":"Displays a dialog box that allows user to ' + 'select a folder on the local system.","name":' + '"ShowBrowseDialog","parameters":[{"documentation":"The ' + 'callback function for results.","name":"callback","required":' + 'true,"type":"callback"}]},{"documentation":"Uploads all mp3 files' + ' in the folder provided.","name":"UploadFolder","parameters":' + '[{"documentation":"The path to upload mp3 files from."' + ',"name":"path","required":true,"type":"string"},{"documentation":' + ' "The callback function for progress.","name":"callback",' + '"required":true,"type":"callback"}]},{"documentation":"Returns' + ' the server name to the current locker service.",' + '"name":"GetLockerService","parameters":[]},{"documentation":' + '"Changes the name of the locker service.","name":"SetLockerSer' + 'vice","parameters":[{"documentation":"The value of the locker' + ' service to set active.","name":"LockerService","required":true' + ',"type":"string"}]},{"documentation":"Downloads locker files to' + ' the suggested folder.","name":"DownloadFile","parameters":[{"' + 'documentation":"The origin path of the locker file.",' + '"name":"path","required":true,"type":"string"},{"documentation"' + ':"The Window destination path of the locker file.",' + '"name":"destination","required":true,"type":"integer"},{"docum' + 'entation":"The callback function for progress.","name":' + '"callback","required":true,"type":"callback"}]}],' + '"name":"LockerUploader","version":{"major":0,' + '"micro":1,"minor":0},"versionString":"0.0.1"}',
        events: [
            ["openobject", undefined],
            ["key", "CoreletAPIVersion"],
            ["simplevalue", 2],
            ["key", "CoreletType"],
            ["simplevalue", "standalone"],
            ["key", "documentation"],
            ["simplevalue", "A corelet that provides the capability to upload a folder’s contents into a user’s locker."],
            ["key", "functions"],
            ["openarray", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "Displays a dialog box that allows user to select a folder on the local system."],
            ["key", "name"],
            ["simplevalue", "ShowBrowseDialog"],
            ["key", "parameters"],
            ["openarray", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "The callback function for results."],
            ["key", "name"],
            ["simplevalue", "callback"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "callback"],
            ["closeobject", undefined],
            ["closearray", undefined],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "Uploads all mp3 files in the folder provided."],
            ["key", "name"],
            ["simplevalue", "UploadFolder"],
            ["key", "parameters"],
            ["openarray", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "The path to upload mp3 files from."],
            ["key", "name"],
            ["simplevalue", "path"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "string"],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "The callback function for progress."],
            ["key", "name"],
            ["simplevalue", "callback"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "callback"],
            ["closeobject", undefined],
            ["closearray", undefined],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "Returns the server name to the current locker service."],
            ["key", "name"],
            ["simplevalue", "GetLockerService"],
            ["key", "parameters"],
            ["openarray", undefined],
            ["closearray", undefined],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "Changes the name of the locker service."],
            ["key", "name"],
            ["simplevalue", "SetLockerService"],
            ["key", "parameters"],
            ["openarray", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "The value of the locker service to set active."],
            ["key", "name"],
            ["simplevalue", "LockerService"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "string"],
            ["closeobject", undefined],
            ["closearray", undefined],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "Downloads locker files to the suggested folder."],
            ["key", "name"],
            ["simplevalue", "DownloadFile"],
            ["key", "parameters"],
            ["openarray", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "The origin path of the locker file."],
            ["key", "name"],
            ["simplevalue", "path"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "string"],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "The Window destination path of the locker file."],
            ["key", "name"],
            ["simplevalue", "destination"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "integer"],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "documentation"],
            ["simplevalue", "The callback function for progress."],
            ["key", "name"],
            ["simplevalue", "callback"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "callback"],
            ["closeobject", undefined],
            ["closearray", undefined],
            ["closeobject", undefined],
            ["closearray", undefined],
            ["key", "name"],
            ["simplevalue", "LockerUploader"],
            ["key", "version"],
            ["openobject", undefined],
            ["key", "major"],
            ["simplevalue", 0],
            ["key", "micro"],
            ["simplevalue", 1],
            ["key", "minor"],
            ["simplevalue", 0],
            ["closeobject", undefined],
            ["key", "versionString"],
            ["simplevalue", "0.0.1"],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    array_of_arrays: {
        text: '[[[["foo"]]]]',
        events: [
            ["openarray", undefined],
            ["openarray", undefined],
            ["openarray", undefined],
            ["openarray", undefined],
            ["simplevalue", "foo"],
            ["closearray", undefined],
            ["closearray", undefined],
            ["closearray", undefined],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    low_overflow: {
        text: '[-9223372036854775808]',
        chunks: [
            '[-92233720',
            '36854775808]'],
        events: [
            ["openarray", undefined],
            ["simplevalue", -9223372036854775808],
            ["closearray", undefined, 1, 22],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    high_overflow: {
        text: '[9223372036854775808]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 9223372036854775808],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    floats: {
        text: '[0.1e2, 1e1, 3.141569, 10000000000000e-10]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 0.1e2],
            ["simplevalue", 1e1],
            ["simplevalue", 3.141569],
            ["simplevalue", 10000000000000e-10],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    numbers_game: {
        text: '[1,0,-1,-0.3,0.3,1343.32,3345,3.1e124,'
            + ' 9223372036854775807,-9223372036854775807,0.1e2, '
            + '1e1, 3.141569, 10000000000000e-10,'
            + '0.00011999999999999999, 6E-06, 6E-06, 1E-06, 1E-06,'
            + '"2009-10-20@20:38:21.539575", 9223372036854775808,'
            + '123456789,-123456789,'
            + '2147483647, -2147483647]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 1],
            ["simplevalue", 0],
            ["simplevalue", -1],
            ["simplevalue", -0.3],
            ["simplevalue", 0.3],
            ["simplevalue", 1343.32],
            ["simplevalue", 3345],
            ["simplevalue", 3.1e124],
            ["simplevalue", 9223372036854775807],
            ["simplevalue", -9223372036854775807],
            ["simplevalue", 0.1e2],
            ["simplevalue", 1e1],
            ["simplevalue", 3.141569],
            ["simplevalue", 10000000000000e-10],
            ["simplevalue", 0.00011999999999999999],
            ["simplevalue", 6E-06],
            ["simplevalue", 6E-06],
            ["simplevalue", 1E-06],
            ["simplevalue", 1E-06],
            ["simplevalue", "2009-10-20@20:38:21.539575"],
            ["simplevalue", 9223372036854775808],
            ["simplevalue", 123456789],
            ["simplevalue", -123456789],
            ["simplevalue", 2147483647],
            ["simplevalue", -2147483647],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    johnsmith: {
        text: '{ "firstName": "John", "lastName" : "Smith", "age" : ' + '25, "address" : { "streetAddress": "21 2nd Street", ' + '"city" : "New York", "state" : "NY", "postalCode" : ' + ' "10021" }, "phoneNumber": [ { "type" : "home", ' + '"number": "212 555-1234" }, { "type" : "fax", ' + '"number": "646 555-4567" } ] }',
        events: [
            ["openobject", undefined],
            ["key", "firstName"],
            ["simplevalue", "John"],
            ["key", "lastName"],
            ["simplevalue", "Smith"],
            ["key", "age"],
            ["simplevalue", 25],
            ["key", "address"],
            ["openobject", undefined],
            ["key", "streetAddress"],
            ["simplevalue", "21 2nd Street"],
            ["key", "city"],
            ["simplevalue", "New York"],
            ["key", "state"],
            ["simplevalue", "NY"],
            ["key", "postalCode"],
            ["simplevalue", "10021"],
            ["closeobject", undefined],
            ["key", "phoneNumber"],
            ["openarray", undefined],
            ["openobject", undefined],
            ["key", "type"],
            ["simplevalue", "home"],
            ["key", "number"],
            ["simplevalue", "212 555-1234"],
            ["closeobject", undefined],
            ["openobject", undefined],
            ["key", "type"],
            ["simplevalue", "fax"],
            ["key", "number"],
            ["simplevalue", "646 555-4567"],
            ["closeobject", undefined],
            ["closearray", undefined],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    array_null: {
        text: '[null,false,true]',
        chunks: [
            '[nu',
            'll,',
            'fa',
            'lse,',
            'tr',
            'ue]'],
        events: [
            ["openarray", undefined, 1, 1],
            ["simplevalue", null, 1, 5],
            ["simplevalue", false, 1, 11],
            ["simplevalue", true, 1, 16],
            ["closearray", undefined, 1, 17],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    empty_array_comma: {
        text: '{"a":[],"c": {}, "b": true}',
        events: [
            ["openobject", undefined, 1, 1],
            ["key", "a"],
            ["openarray", undefined, 1, 6],
            ["closearray", undefined, 1, 7],
            ["key", "c"],
            ["openobject", undefined],
            ["closeobject", undefined],
            ["key", "b"],
            ["simplevalue", true],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    incomplete_json_terminates_ending_in_number: {
        text: '[[1,2,3],[42,0',
        events: [
            ["openarray", undefined, 1, 1],
            ["openarray", undefined, 1, 2],
            ["simplevalue", 1, 1, 3],
            ["simplevalue", 2, 1, 5],
            ["simplevalue", 3, 1, 7],
            ["closearray", undefined, 1, 8],
            ["openarray", undefined, 1, 10],
            ["simplevalue", 42, 1, 12],
            ["simplevalue", 0],
            ['error', undefined]
        ]
    },
    incomplete_json_terminates_ending_in_comma: {
        text: '[[1,2,42],',
        events: [
            ["openarray", undefined],
            ["openarray", undefined],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["simplevalue", 42],
            ["closearray", undefined],
            ['error', undefined]
        ]
    },
    json_org: {
        text: ('{\r\n' + '                    "glossary": {\n' + '                            "title": "example glossary",\n\r' + '            \t\t"GlossDiv": {\r\n' + '                                    "title": "S",\r\n' + '            \t\t\t"GlossList": {\r\n' + '                                            "GlossEntry": {\r\n' + '                                                    "ID": "SGML",\r\n' + '            \t\t\t\t\t"SortAs": "SGML",\r\n' + '            \t\t\t\t\t"GlossTerm": "Standard Generalized ' + 'Markup Language",\r\n' + '            \t\t\t\t\t"Acronym": "SGML",\r\n' + '            \t\t\t\t\t"Abbrev": "ISO 8879:1986",\r\n' + '            \t\t\t\t\t"GlossDef": {\r\n' + '                                                            "para": "A meta-markup language,' + ' used to create markup languages such as DocBook.",\r\n' + '            \t\t\t\t\t\t"GlossSeeAlso": ["GML", "XML"]\r\n' + '                                                    },\r\n' + '            \t\t\t\t\t"GlossSee": "markup"\r\n' + '                                            }\r\n' + '                                    }\r\n' + '                            }\r\n' + '                    }\r\n' + '            }\r\n'),
        events: [
            ["openobject", undefined],
            ["key", "glossary"],
            ["openobject", undefined],
            ["key", "title"],
            ["simplevalue", "example glossary"],
            ["key", "GlossDiv"],
            ["openobject", undefined],
            ["key", "title"],
            ["simplevalue", "S"],
            ["key", "GlossList"],
            ["openobject", undefined],
            ["key", "GlossEntry"],
            ["openobject", undefined],
            ["key", "ID"],
            ["simplevalue", "SGML"],
            ["key", "SortAs"],
            ["simplevalue", "SGML"],
            ["key", "GlossTerm"],
            ["simplevalue", "Standard Generalized Markup Language"],
            ["key", "Acronym"],
            ["simplevalue", "SGML"],
            ["key", "Abbrev"],
            ["simplevalue", 'ISO 8879:1986'],
            ["key", "GlossDef"],
            ["openobject", undefined],
            ["key", "para"],
            ["simplevalue", 'A meta-markup language, used to create markup languages such as DocBook.'],
            ["key", "GlossSeeAlso"],
            ["openarray", undefined],
            ["simplevalue", "GML"],
            ["simplevalue", "XML"],
            ["closearray", undefined],
            ["closeobject", undefined],
            ["key", "GlossSee"],
            ["simplevalue", "markup"],
            ["closeobject", undefined],
            ["closeobject", undefined],
            ["closeobject", undefined],
            ["closeobject", undefined],
            ["closeobject", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    string_chunk_span: {
        text: '["L\'OrÃ©al", "LÃ©\'Oral", "Ã©alL\'Or"]',
        chunks: [
            '["L\'OrÃ',
            '©al", "LÃ©\'Oral", "Ã©alL\'Or"]'],
        events: [
            ["openarray", undefined],
            ["simplevalue", 'L\'OrÃ©al'],
            ["simplevalue", 'LÃ©\'Oral'],
            ["simplevalue", 'Ã©alL\'Or'],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    forbidden_extension_apostrophe_string: {
        text: "'a string'",
        events: [
            ["error", undefined],
        ],
    },
    multiline_string: {
        text: '["a\nstring"]',
        events: [
            ["openarray", undefined],
            ["simplevalue", "a\nstring"],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined],
        ],
    },
    forbidden_extension_trailing_comma: {
        text: '[1,2,]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["error", undefined],
        ]
    },
    forbidden_extension_multi_line_comment: {
        text: '[1,2/*a comment\r\n*/]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["error", undefined],
        ]
    },
    forbidden_extension_parens_instead_of_braces: {
        text: '( a: "foo" )',
        options: {
        },
        events: [
            ["error", undefined],
        ]
    },
    forbidden_extension_missing_comma: {
        text: '["foo""bar"]',
        options: {
        },
        events: [
            ["openarray", undefined],
            ["simplevalue", "foo"],
            ["error", undefined],
        ]
    },
    forbidden_extension_angle_brackets_instead_of_brackets: {
        text: '<"foo">',
        options: {
        },
        events: [
            ["error", undefined],
        ]
    },
    forbidden_extension_single_line_comment: {
        text: '[1,2//a comment\r\n]',
        events: [
            ["openarray", undefined],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["error", undefined],
        ]
    },
    forbidden_typed_union: {
        text: '| "foo", {}',
        events: [
            ["error", undefined],
        ]
    },
}
