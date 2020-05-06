/* eslint
    @typescript-eslint/camelcase: "off",
    camelcase:"off",
*/
import { TestDefinitions } from "./testDefinition";


export const extensionTests: TestDefinitions = {
    "trailing comma": {
        text: '[1,2,]',
        events: [
            ["token","openarray", "[", undefined],
            ["token","unquotedtoken", "1", undefined],
            ["token","unquotedtoken", "2", undefined],
            ["token","closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "single line comment": {
        text: '[1,"a"//a comment\r\n]',
        skipRoundTripCheck: true,
        events: [
            ["token","openarray", "[", undefined],
            ["token","unquotedtoken", "1", undefined],
            ["token","quotedstring", "a", undefined],
            ["token","linecomment", "a comment", undefined],
            ["token","closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "multi line comment": {
        text: '[1,"a"/*a comment\r\n*/]',
        events: [
            ["token","openarray", "[", undefined],
            ["token","unquotedtoken", "1", undefined],
            ["token","quotedstring", "a", undefined],
            ["token","blockcomment", "a comment\r\n", undefined],
            ["token","closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "multi line comment 2": {
        text: '[1,"a"/*a comment b * c*/]',
        events: [
            ["token","openarray", "[", undefined],
            ["token","unquotedtoken", "1", undefined],
            ["token","quotedstring", "a", undefined],
            ["token","blockcomment", "a comment b * c", undefined],
            ["token","closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "parens instead of braces": {
        text: '( "a": "foo" )',
        events: [
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "a", undefined],
            ["token","quotedstring", "foo", undefined],
            ["token","closeobject", ")", undefined],
            ["end", undefined],
        ],
    },
    "missing comma": {
        text: '["foo""bar"]',
        events: [
            ["token","openarray", "[", undefined],
            ["token","quotedstring", "foo", undefined],
            ["token","quotedstring", "bar", undefined],
            ["token","closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "angle brackets instead of brackets": {
        text: '<"foo">',
        events: [
            ["token","openarray", "<", undefined],
            ["token","quotedstring", "foo", undefined],
            ["token","closearray", ">", undefined],
            ["end", undefined],
        ],
    },
    "apostrophe string": {
        text: "'a string'",
        testForLocation: true,
        events: [
            ["token","quotedstring", "a string", [1, 1, 1, 11]],
            ["end", [1, 11]],
        ],
    },
    "tagged union": {
        text: '| "foo" "x"',
        events: [
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "foo", undefined],
            ["token","quotedstring", "x", undefined],
            //["closetaggedunion"],
            ["end", undefined],
        ],
    },
    "incomplete tagged union": {
        text: '| "foo"',
        events: [
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "foo", undefined],
            ["parsererror", "unexpected end of document, still in tagged union"],
            //["closetaggedunion"],
            ["end", undefined],
        ],
    },
    "incomplete tagged union in object": {
        text: '( "a" : | "foo" )',
        events: [
            ["token","openobject", "(", undefined],
            ["token","quotedstring", "a", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "foo", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", ")", undefined],
            ["stacked error", "missing value"],
            ["stacked error", "missing tagged union value"],
            ["parsererror", "unexpected end of document, still in tagged union"],
            ["parsererror", "unexpected end of document, still in object"],
            ["end", undefined],
        ],
    },
    "incomplete tagged union in object 2": {
        text: '( "a" : | )',
        events: [
            ["token","openobject", "(", undefined],
            ["token","quotedstring", "a", undefined],
            ["token","opentaggedunion", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", ")", undefined],
            ["stacked error", "missing tagged union option and value"],
            ["parsererror", "unexpected end of document, still in tagged union"],
            ["parsererror", "unexpected end of document, still in object"],
            //["closetaggedunion"],
            ["end", undefined],
        ],
    },
    "tagged union with number at end": {
        text: '| "foo" 5',
        events: [
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "foo", undefined],
            ["token","unquotedtoken", "5", undefined],
            //["closetaggedunion"],
            ["end", undefined],
        ],
    },
    "tagged union with missing data": {
        text: '{ "bla": | "foo" }',
        events: [
            ["token","openobject", "{", undefined],
            ["token","quotedstring"/*key*/, "bla", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "foo", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", "}", undefined],
            ["stacked error", "missing value"],
            ["stacked error", "missing tagged union value"],
            ["parsererror", "unexpected end of document, still in tagged union"],
            ["parsererror", "unexpected end of document, still in object"],
            ["end", undefined],
        ],
    },
    "double tagged union with missing data": {
        text: '{ "bla": | "foo" | "bar" }',
        events: [
            ["token","openobject", "{", undefined],
            ["token","quotedstring"/*key*/, "bla", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "foo", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "bar", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", "}", undefined],
            ["stacked error", "missing value"],
            ["stacked error", "missing tagged union value"],
            ["parsererror", "unexpected end of document, still in tagged union"],
            ["parsererror", "unexpected end of document, still in tagged union"],
            ["parsererror", "unexpected end of document, still in object"],
            ["end", undefined],
        ],
    },
    "schema optional": {
        text: '!"a schema" 42',
        testHeaders: true,
        events: [
            ["token","headerstart"],
            ["token","quotedstring", "a schema", undefined],
            ["headerend"],
            ["token","unquotedtoken", "42", undefined],
            ["end", undefined],
        ],
    },
    "schema optional but not there": {
        text: "42",
        testHeaders: true,
        events: [
            ["headerend"],
            ["token","unquotedtoken", "42", undefined],
            ["end", undefined],
        ],
    },
    "schema required": {
        text: '! "a schema" 42',
        testHeaders: true,
        events: [
            ["token","headerstart"],
            ["token","quotedstring", "a schema", undefined],
            ["headerend"],
            ["token","unquotedtoken", "42", undefined],
            ["end", undefined],
        ],
    },
    "internal schema": {
        text: `! (
            'component types': {
                'root': (
                    'node': (
                        'properties': {
                            'a1': (
                                'type': | 'value' (
                                    'type': | 'number' (
                                    )
                                )
                            )
                            'b': (
                                'type': | 'value' (
                                    'type': | 'number' (
                                    )
                                )
                            )
                            'c': (
                                'type': | 'value' (
                                    'type': | 'text' (
                                    )
                                )
                            )
                        }
                    )
                )
            }
            'root type': 'root'
        )
        {
            "a": "B"
            "b": "X"
            "c": "C"
        }`,
        testHeaders: true,
        events: [
            ["token","headerstart"],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "component types", undefined],
            ["token","openobject", "{", undefined],
            ["token","quotedstring"/*key*/, "root", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "node", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "properties", undefined],
            ["token","openobject", "{", undefined],
            ["token","quotedstring"/*key*/, "a1", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "value", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "number", undefined],
            ["token","openobject", "(", undefined],
            ["token","closeobject", ")", undefined],
            //["closetaggedunion"],
            ["token","closeobject", ")", undefined],
            //["closetaggedunion"],
            ["token","closeobject", ")", undefined],
            ["token","quotedstring"/*key*/, "b", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "value", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "number", undefined],
            ["token","openobject", "(", undefined],
            ["token","closeobject", ")", undefined],
            //["closetaggedunion"],
            ["token","closeobject", ")", undefined],
            //["closetaggedunion"],
            ["token","closeobject", ")", undefined],
            ["token","quotedstring"/*key*/, "c", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "value", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "text", undefined],
            ["token","openobject", "(", undefined],
            ["token","closeobject", ")", undefined],
            //["closetaggedunion"],
            ["token","closeobject", ")", undefined],
            //["closetaggedunion"],
            ["token","closeobject", ")", undefined],
            ["token","closeobject", "}", undefined],
            ["token","closeobject", ")", undefined],
            ["token","closeobject", ")", undefined],
            ["token","closeobject", "}", undefined],
            ["token","quotedstring"/*key*/, "root type", undefined],
            ["token","quotedstring", "root", undefined],
            ["token","closeobject", ")", undefined],
            ["headerend"],
            ["token","openobject", "{", undefined],
            ["token","quotedstring"/*key*/, "a", undefined],
            ["token","quotedstring", "B", undefined],
            ["token","quotedstring"/*key*/, "b", undefined],
            ["token","quotedstring", "X", undefined],
            ["token","quotedstring"/*key*/, "c", undefined],
            ["token","quotedstring", "C", undefined],
            ["token","closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
    "invalid internal schema": {
        text: `! (
            'component types': {
                'x': (
                    'node': (
                        'properties': {
                            'foo': (
                                'type': | 'value' (
                                    'type': | 'number'
                                )
                            )
                            'bar': (
                                'type': | 'taggedunion' (
                                    'type': | 'number'
                                )
                            )
                        }
                    )
                )
            }
            'root type': "x"
        )
        (
            'foov': 42
        )
        `,
        testHeaders: true,
        events: [
            ["token","headerstart"],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "component types", undefined],
            ["token","openobject", "{", undefined],
            ["token","quotedstring"/*key*/, "x", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "node", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "properties", undefined],
            ["token","openobject", "{", undefined],
            ["token","quotedstring"/*key*/, "foo", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "value", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "number", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", ")", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", ")", undefined],
            ["token","quotedstring", "bar", undefined],
            //["closetaggedunion"],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "taggedunion", undefined],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "type", undefined],
            ["token","opentaggedunion", undefined],
            ["token","quotedstring"/*option*/, "number", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", ")", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", ")", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", "}", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", ")", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", ")", undefined],
            ["parsererror", "not in an object"],
            ["token","closeobject", "}", undefined],
            ["token","quotedstring", "root type", undefined],
            //["closetaggedunion"],
            ["token","quotedstring"/*key*/, "x", undefined],
            ["parsererror", "missing property value"],
            ["token","closeobject", ")", undefined],
            //["closetaggedunion"],
            ["token","openobject", "(", undefined],
            ["token","quotedstring"/*key*/, "foov", undefined],
            ["token","unquotedtoken", "42", undefined],
            ["token","closeobject", ")", undefined],
            ["parsererror", "unexpected end of document, still in object"],
            ["parsererror", "unexpected end of document, still in object"],
            ["parsererror", "unexpected end of document, still in tagged union"],
            ["parsererror", "unexpected end of document, still in object"],
            ["parsererror", "unexpected end of document, still in object"],
            ["parsererror", "unexpected end of document, still in object"],
            ["parsererror", "unexpected end of document, still in object"],
            ["parsererror", "unexpected end of document, still in object"],
            ["parsererror", "unexpected end of document, still in object"],
            ["parsererror", "expected hash or rootvalue"],
            ["headerend"],
            ["end", undefined],
        ],
    },
}
