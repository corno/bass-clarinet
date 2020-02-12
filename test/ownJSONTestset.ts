import { TestDefinitions } from "./testDefinition";


export const JSONTests: TestDefinitions = {
    just_a_string: {
        text: '"a string"',
        events: [
            ["simplevalue", "a string", 1, 10],
            ["end"],
            ["ready"],
        ],
    },
    just_a_number: {
        text: '42',
        events: [
            ["simplevalue", 42],
            ["end"],
            ["ready"],
        ],
    },
    empty_array: {
        text: '[]',
        events: [
            ["openarray", 1, 1],
            ["closearray", 1, 2],
            ["end"],
            ["ready"]
        ]
    },
    just_slash: {
        text: '["\\\\"]',
        events: [
            ["openarray"],
            ["simplevalue", "\\"],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    zero_byte: {
        text: '{"foo": "\\u0000"}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["simplevalue", "\u0000"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    empty_value: {
        text: '{"foo": ""}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["simplevalue", ""],
            ["closeobject"],
            ["end"],
            ["ready"],
        ]
    },
    empty_key: {
        text: '{"foo": "bar", "": "baz"}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["simplevalue", "bar"],
            ["key", ""],
            ["simplevalue", "baz"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    three_byte_utf8: {
        text: '{"matzue": "松江", "asakusa": "浅草"}',
        events: [
            ["openobject"],
            ["key", "matzue"],
            ["simplevalue", "松江"],
            ["key", "asakusa"],
            ["simplevalue", "浅草"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    four_byte_utf8: {
        text: '{ "U+10ABCD": "������" }',
        events: [
            ["openobject"],
            ["key", "U+10ABCD"],
            ["simplevalue", "������"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    bulgarian: {
        text: '["Да Му Еба Майката"]',
        events: [
            ["openarray"],
            ["simplevalue", "Да Му Еба Майката"],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    codepoints_from_unicodes: {
        text: '["\\u004d\\u0430\\u4e8c\\ud800\\udf02"]',
        events: [
            ["openarray"],
            ["simplevalue", "\u004d\u0430\u4e8c\ud800\udf02"],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    empty_object: {
        text: '{}',
        events: [
            ["openobject"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    foobar: {
        text: '{"foo": "bar"}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["simplevalue", "bar"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    as_is: {
        text: "{\"foo\": \"its \\\"as is\\\", \\\"yeah\", \"bar\": false}",
        events: [
            ["openobject"],
            ["key", "foo"],
            ["simplevalue", 'its "as is", "yeah'],
            ["key", "bar"],
            ["simplevalue", false],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    array: {
        text: '["one", "two"]',
        events: [
            ["openarray"],
            ["simplevalue", 'one'],
            ["simplevalue", 'two'],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    array_fu: {
        text: '["foo", "bar", "baz",true,false,null,{"key":"simplevalue"},' + '[null,null,null,[]]," \\\\ "]',
        events: [
            ["openarray"],
            ["simplevalue", 'foo'],
            ["simplevalue", 'bar'],
            ["simplevalue", 'baz'],
            ["simplevalue", true],
            ["simplevalue", false],
            ["simplevalue", null],
            ["openobject"],
            ["key", 'key'],
            ["simplevalue", "simplevalue"],
            ["closeobject"],
            ["openarray"],
            ["simplevalue", null],
            ["simplevalue", null],
            ["simplevalue", null],
            ["openarray"],
            ["closearray"],
            ["closearray"],
            ["simplevalue", " \\ "],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    simple_exp: {
        text: '[10e-01]',
        events: [
            ["openarray"],
            ["simplevalue", 10e-01],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    nested: {
        text: '{"a":{"b":"c"}}',
        events: [
            ["openobject"],
            ["key", "a"],
            ["openobject"],
            ["key", "b"],
            ["simplevalue", "c"],
            ["closeobject"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    nested_array: {
        text: '{"a":["b", "c"]}',
        events: [
            ["openobject"],
            ["key", "a"],
            ["openarray"],
            ["simplevalue", 'b'],
            ["simplevalue", 'c'],
            ["closearray"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    array_of_objs: {
        text: '[{"a":"b"}, {"c":"d"}]',
        events: [
            ["openarray"],
            ["openobject"],
            ["key", "a"],
            ["simplevalue", 'b'],
            ["closeobject"],
            ["openobject"],
            ["key", "c"],
            ["simplevalue", 'd'],
            ["closeobject"],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    two_keys: {
        text: '{"a": "b", "c": "d"}',
        events: [
            ["openobject"],
            ["key", "a"],
            ["simplevalue", "b"],
            ["key", "c"],
            ["simplevalue", "d"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    key_true: {
        text: '{"foo": true, "bar": false, "baz": null}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["simplevalue", true],
            ["key", "bar"],
            ["simplevalue", false],
            ["key", "baz"],
            ["simplevalue", null],
            ["closeobject", 1, 40],
            ["end"],
            ["ready"]
        ]
    },
    obj_strange_strings: {
        text: '{"foo": "bar and all\\\"", "bar": "its \\\"nice\\\""}',
        events: [
            ["openobject"],
            ["key", "foo"],
            ["simplevalue", 'bar and all"'],
            ["key", "bar"],
            ["simplevalue", 'its "nice"'],
            ["closeobject", 1, 47],
            ["end"],
            ["ready"]
        ]
    },
    bad_foo_bar: {
        text: '["foo", "bar"',
        events: [
            ["openarray"],
            ["simplevalue", 'foo'],
            ["simplevalue", 'bar'],
            ['error'],
            //["end"],
            //["ready"]
        ]
    },
    string_invalid_escape: {
        text: '["and you can\'t escape thi\s"]',
        events: [
            ["openarray", 1, 1],
            ["simplevalue", 'and you can\'t escape this', 1, 28],
            ["closearray", 1, 29],
            ["end"],
            ["ready"]
        ]
    },
    nuts_and_bolts: {
        text: '{"boolean, true": true' + ', "boolean, false": false' + ', "null": null }',
        events: [
            ["openobject"],
            ["key", "boolean, true"],
            ["simplevalue", true],
            ["key", "boolean, false"],
            ["simplevalue", false],
            ["key", "null"],
            ["simplevalue", null],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    frekin_string: {
        text: '["\\\\\\"\\"a\\""]',
        events: [
            ["openarray"],
            ["simplevalue", '\\\"\"a\"'],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    array_of_string_insanity: {
        text: '["\\\"and this string has an escape at the beginning",' + '"and this string has no escapes"]',
        events: [
            ["openarray"],
            ["simplevalue", "\"and this string has an escape at the beginning"],
            ["simplevalue", "and this string has no escapes"],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    non_utf8: {
        text: '{"CoreletAPIVersion":2,"CoreletType":"standalone",' + '"documentation":"A corelet that provides the capability to upload' + ' a folder’s contents into a user’s locker.","functions":[' + '{"documentation":"Displays a dialog box that allows user to ' + 'select a folder on the local system.","name":' + '"ShowBrowseDialog","parameters":[{"documentation":"The ' + 'callback function for results.","name":"callback","required":' + 'true,"type":"callback"}]},{"documentation":"Uploads all mp3 files' + ' in the folder provided.","name":"UploadFolder","parameters":' + '[{"documentation":"The path to upload mp3 files from."' + ',"name":"path","required":true,"type":"string"},{"documentation":' + ' "The callback function for progress.","name":"callback",' + '"required":true,"type":"callback"}]},{"documentation":"Returns' + ' the server name to the current locker service.",' + '"name":"GetLockerService","parameters":[]},{"documentation":' + '"Changes the name of the locker service.","name":"SetLockerSer' + 'vice","parameters":[{"documentation":"The value of the locker' + ' service to set active.","name":"LockerService","required":true' + ',"type":"string"}]},{"documentation":"Downloads locker files to' + ' the suggested folder.","name":"DownloadFile","parameters":[{"' + 'documentation":"The origin path of the locker file.",' + '"name":"path","required":true,"type":"string"},{"documentation"' + ':"The Window destination path of the locker file.",' + '"name":"destination","required":true,"type":"integer"},{"docum' + 'entation":"The callback function for progress.","name":' + '"callback","required":true,"type":"callback"}]}],' + '"name":"LockerUploader","version":{"major":0,' + '"micro":1,"minor":0},"versionString":"0.0.1"}',
        events: [
            ["openobject"],
            ["key", "CoreletAPIVersion"],
            ["simplevalue", 2],
            ["key", "CoreletType"],
            ["simplevalue", "standalone"],
            ["key", "documentation"],
            ["simplevalue", "A corelet that provides the capability to upload a folder’s contents into a user’s locker."],
            ["key", "functions"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "Displays a dialog box that allows user to select a folder on the local system."],
            ["key", "name"],
            ["simplevalue", "ShowBrowseDialog"],
            ["key", "parameters"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "The callback function for results."],
            ["key", "name"],
            ["simplevalue", "callback"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "callback"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "Uploads all mp3 files in the folder provided."],
            ["key", "name"],
            ["simplevalue", "UploadFolder"],
            ["key", "parameters"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "The path to upload mp3 files from."],
            ["key", "name"],
            ["simplevalue", "path"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "string"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "The callback function for progress."],
            ["key", "name"],
            ["simplevalue", "callback"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "callback"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "Returns the server name to the current locker service."],
            ["key", "name"],
            ["simplevalue", "GetLockerService"],
            ["key", "parameters"],
            ["openarray"],
            ["closearray"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "Changes the name of the locker service."],
            ["key", "name"],
            ["simplevalue", "SetLockerService"],
            ["key", "parameters"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "The value of the locker service to set active."],
            ["key", "name"],
            ["simplevalue", "LockerService"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "string"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "Downloads locker files to the suggested folder."],
            ["key", "name"],
            ["simplevalue", "DownloadFile"],
            ["key", "parameters"],
            ["openarray"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "The origin path of the locker file."],
            ["key", "name"],
            ["simplevalue", "path"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "string"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "The Window destination path of the locker file."],
            ["key", "name"],
            ["simplevalue", "destination"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "integer"],
            ["closeobject"],
            ["openobject"],
            ["key", "documentation"],
            ["simplevalue", "The callback function for progress."],
            ["key", "name"],
            ["simplevalue", "callback"],
            ["key", "required"],
            ["simplevalue", true],
            ["key", "type"],
            ["simplevalue", "callback"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["closearray"],
            ["key", "name"],
            ["simplevalue", "LockerUploader"],
            ["key", "version"],
            ["openobject"],
            ["key", "major"],
            ["simplevalue", 0],
            ["key", "micro"],
            ["simplevalue", 1],
            ["key", "minor"],
            ["simplevalue", 0],
            ["closeobject"],
            ["key", "versionString"],
            ["simplevalue", "0.0.1"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    array_of_arrays: {
        text: '[[[["foo"]]]]',
        events: [
            ["openarray"],
            ["openarray"],
            ["openarray"],
            ["openarray"],
            ["simplevalue", "foo"],
            ["closearray"],
            ["closearray"],
            ["closearray"],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    low_overflow: {
        text: '[-9223372036854775808]',
        chunks: [
            '[-92233720',
            '36854775808]'],
        events: [
            ["openarray"],
            ["simplevalue", -9223372036854775808],
            ["closearray", 1, 22],
            ["end"],
            ["ready"]
        ]
    },
    high_overflow: {
        text: '[9223372036854775808]',
        events: [
            ["openarray"],
            ["simplevalue", 9223372036854775808],
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    floats: {
        text: '[0.1e2, 1e1, 3.141569, 10000000000000e-10]',
        events: [
            ["openarray"],
            ["simplevalue", 0.1e2],
            ["simplevalue", 1e1],
            ["simplevalue", 3.141569],
            ["simplevalue", 10000000000000e-10],
            ["closearray"],
            ["end"],
            ["ready"]
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
            ["openarray"],
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
            ["closearray"],
            ["end"],
            ["ready"]
        ]
    },
    johnsmith: {
        text: '{ "firstName": "John", "lastName" : "Smith", "age" : ' + '25, "address" : { "streetAddress": "21 2nd Street", ' + '"city" : "New York", "state" : "NY", "postalCode" : ' + ' "10021" }, "phoneNumber": [ { "type" : "home", ' + '"number": "212 555-1234" }, { "type" : "fax", ' + '"number": "646 555-4567" } ] }',
        events: [
            ["openobject"],
            ["key", "firstName"],
            ["simplevalue", "John"],
            ["key", "lastName"],
            ["simplevalue", "Smith"],
            ["key", "age"],
            ["simplevalue", 25],
            ["key", "address"],
            ["openobject"],
            ["key", "streetAddress"],
            ["simplevalue", "21 2nd Street"],
            ["key", "city"],
            ["simplevalue", "New York"],
            ["key", "state"],
            ["simplevalue", "NY"],
            ["key", "postalCode"],
            ["simplevalue", "10021"],
            ["closeobject"],
            ["key", "phoneNumber"],
            ["openarray"],
            ["openobject"],
            ["key", "type"],
            ["simplevalue", "home"],
            ["key", "number"],
            ["simplevalue", "212 555-1234"],
            ["closeobject"],
            ["openobject"],
            ["key", "type"],
            ["simplevalue", "fax"],
            ["key", "number"],
            ["simplevalue", "646 555-4567"],
            ["closeobject"],
            ["closearray"],
            ["closeobject"],
            ["end"],
            ["ready"],
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
            ["openarray", 1, 1],
            ["simplevalue", null, 1, 5],
            ["simplevalue", false, 1, 11],
            ["simplevalue", true, 1, 16],
            ["closearray", 1, 17],
            ["end"],
            ["ready"]
        ]
    },
    empty_array_comma: {
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
            ["simplevalue", true],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    incomplete_json_terminates_ending_in_number: {
        text: '[[1,2,3],[42,0',
        events: [
            ["openarray", 1, 1],
            ["openarray", 1, 2],
            ["simplevalue", 1, 1, 3],
            ["simplevalue", 2, 1, 5],
            ["simplevalue", 3, 1, 7],
            ["closearray", 1, 8],
            ["openarray", 1, 10],
            ["simplevalue", 42, 1, 12],
            ["simplevalue", 0],
            ['error']
        ]
    },
    incomplete_json_terminates_ending_in_comma: {
        text: '[[1,2,42],',
        events: [
            ["openarray"],
            ["openarray"],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["simplevalue", 42],
            ["closearray"],
            ['error']
        ]
    },
    json_org: {
        text: ('{\r\n' + '                    "glossary": {\n' + '                            "title": "example glossary",\n\r' + '            \t\t"GlossDiv": {\r\n' + '                                    "title": "S",\r\n' + '            \t\t\t"GlossList": {\r\n' + '                                            "GlossEntry": {\r\n' + '                                                    "ID": "SGML",\r\n' + '            \t\t\t\t\t"SortAs": "SGML",\r\n' + '            \t\t\t\t\t"GlossTerm": "Standard Generalized ' + 'Markup Language",\r\n' + '            \t\t\t\t\t"Acronym": "SGML",\r\n' + '            \t\t\t\t\t"Abbrev": "ISO 8879:1986",\r\n' + '            \t\t\t\t\t"GlossDef": {\r\n' + '                                                            "para": "A meta-markup language,' + ' used to create markup languages such as DocBook.",\r\n' + '            \t\t\t\t\t\t"GlossSeeAlso": ["GML", "XML"]\r\n' + '                                                    },\r\n' + '            \t\t\t\t\t"GlossSee": "markup"\r\n' + '                                            }\r\n' + '                                    }\r\n' + '                            }\r\n' + '                    }\r\n' + '            }\r\n'),
        events: [
            ["openobject"],
            ["key", "glossary"],
            ["openobject"],
            ["key", "title"],
            ["simplevalue", "example glossary"],
            ["key", "GlossDiv"],
            ["openobject"],
            ["key", "title"],
            ["simplevalue", "S"],
            ["key", "GlossList"],
            ["openobject"],
            ["key", "GlossEntry"],
            ["openobject"],
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
            ["openobject"],
            ["key", "para"],
            ["simplevalue", 'A meta-markup language, used to create markup languages such as DocBook.'],
            ["key", "GlossSeeAlso"],
            ["openarray"],
            ["simplevalue", "GML"],
            ["simplevalue", "XML"],
            ["closearray"],
            ["closeobject"],
            ["key", "GlossSee"],
            ["simplevalue", "markup"],
            ["closeobject"],
            ["closeobject"],
            ["closeobject"],
            ["closeobject"],
            ["closeobject"],
            ["end"],
            ["ready"]
        ]
    },
    string_chunk_span: {
        text: '["L\'OrÃ©al", "LÃ©\'Oral", "Ã©alL\'Or"]',
        chunks: [
            '["L\'OrÃ',
            '©al", "LÃ©\'Oral", "Ã©alL\'Or"]'],
        events: [
            ["openarray"],
            ["simplevalue", 'L\'OrÃ©al'],
            ["simplevalue", 'LÃ©\'Oral'],
            ["simplevalue", 'Ã©alL\'Or'],
            ["closearray"],
            ["end"],
            ["ready"],
        ]
    },
    forbidden_extension_apostrophe_string: {
        text: "'a string'",
        events: [
            ["error"],
        ],
    },
    multiline_string: {
        text: '["a\nstring"]',
        events: [
            ["openarray"],
            ["simplevalue", "a\nstring"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    forbidden_extension_trailing_comma: {
        text: '[1,2,]',
        events: [
            ["openarray"],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["error"],
        ]
    },
    forbidden_extension_multi_line_comment: {
        text: '[1,2/*a comment\r\n*/]',
        events: [
            ["openarray"],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["error"],
        ]
    },
    forbidden_extension_parens_instead_of_braces: {
        text: '( a: "foo" )',
        options: {
        },
        events: [
            ["error"],
        ]
    },
    forbidden_extension_missing_comma: {
        text: '["foo""bar"]',
        options: {
        },
        events: [
            ["openarray"],
            ["simplevalue", "foo"],
            ["error"],
        ]
    },
    forbidden_extension_angle_brackets_instead_of_brackets: {
        text: '<"foo">',
        options: {
        },
        events: [
            ["error"],
        ]
    },
    forbidden_extension_single_line_comment: {
        text: '[1,2//a comment\r\n]',
        events: [
            ["openarray"],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["error"],
        ]
    },
    forbidden_typed_union: {
        text: '| "foo", {}',
        events: [
            ["error"],
        ]
    },
}
