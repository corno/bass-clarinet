/* eslint
    @typescript-eslint/camelcase: "off",
    camelcase:"off",
*/
import { TestDefinitions } from "./testDefinition";


export const extensionTests: TestDefinitions = {
    "trailing comma": {
        text: '[1,2,]',
        events: [
            ["openarray", "[", undefined],
            ["unquotedtoken", "1", undefined],
            ["unquotedtoken", "2", undefined],
            ["closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "single line comment": {
        text: '[1,"a"//a comment\r\n]',
        skipRoundTripCheck: true,
        events: [
            ["openarray", "[", undefined],
            ["unquotedtoken", "1", undefined],
            ["quotedstring", "a", undefined],
            ["linecomment", "a comment", undefined],
            ["closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "multi line comment": {
        text: '[1,"a"/*a comment\r\n*/]',
        events: [
            ["openarray", "[", undefined],
            ["unquotedtoken", "1", undefined],
            ["quotedstring", "a", undefined],
            ["blockcomment", "a comment\r\n", undefined],
            ["closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "multi line comment 2": {
        text: '[1,"a"/*a comment b * c*/]',
        events: [
            ["openarray", "[", undefined],
            ["unquotedtoken", "1", undefined],
            ["quotedstring", "a", undefined],
            ["blockcomment", "a comment b * c", undefined],
            ["closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "parens instead of braces": {
        text: '( "a": "foo" )',
        events: [
            ["openobject", "(", undefined],
            ["key", "a", undefined],
            ["quotedstring", "foo", undefined],
            ["closeobject", ")", undefined],
            ["end", undefined],
        ],
    },
    "missing comma": {
        text: '["foo""bar"]',
        events: [
            ["openarray", "[", undefined],
            ["quotedstring", "foo", undefined],
            ["quotedstring", "bar", undefined],
            ["closearray", "]", undefined],
            ["end", undefined],
        ],
    },
    "angle brackets instead of brackets": {
        text: '<"foo">',
        events: [
            ["openarray", "<", undefined],
            ["quotedstring", "foo", undefined],
            ["closearray", ">", undefined],
            ["end", undefined],
        ],
    },
    "apostrophe string": {
        text: "'a string'",
        testForLocation: true,
        events: [
            ["quotedstring", "a string", [1, 1, 1, 11]],
            ["end", [1, 11]],
        ],
    },
    "tagged union": {
        text: '| "foo" "x"',
        events: [
            ["opentaggedunion", undefined],
            ["option", "foo", undefined],
            ["quotedstring", "x", undefined],
            ["closetaggedunion"],
            ["end", undefined],
        ],
    },
    "tagged union with number at end": {
        text: '| "foo" 5',
        events: [
            ["opentaggedunion", undefined],
            ["option", "foo", undefined],
            ["unquotedtoken", "5", undefined],
            ["closetaggedunion"],
            ["end", undefined],
        ],
    },
    "tagged union with missing data": {
        text: '{ "bla": | "foo" }',
        events: [
            ["openobject", "{", undefined],
            ["key", "bla", undefined],
            ["opentaggedunion", undefined],
            ["option", "foo", undefined],
            ["parsererror", "not in an object"],
            ["closeobject", "}", undefined],
            ["parsererror", "unexpected end of document, still in nested type"],
            ["end", undefined],
        ],
    },
    "schema optional": {
        text: '!"a schema" 42',
        testHeaders: true,
        events: [
            ["headerstart"],
            ["quotedstring", "a schema", undefined],
            ["headerend"],
            ["unquotedtoken", "42", undefined],
            ["end", undefined],
        ],
    },
    "schema optional but not there": {
        text: "42",
        testHeaders: true,
        events: [
            ["headerend"],
            ["unquotedtoken", "42", undefined],
            ["end", undefined],
        ],
    },
    "schema required": {
        text: '! "a schema" 42',
        testHeaders: true,
        events: [
            ["headerstart"],
            ["quotedstring", "a schema", undefined],
            ["headerend"],
            ["unquotedtoken", "42", undefined],
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
            ["headerstart"],
            ["openobject", "(", undefined],
            ["key", "component types", undefined],
            ["openobject", "{", undefined],
            ["key", "root", undefined],
            ["openobject", "(", undefined],
            ["key", "node", undefined],
            ["openobject", "(", undefined],
            ["key", "properties", undefined],
            ["openobject", "{", undefined],
            ["key", "a1", undefined],
            ["openobject", "(", undefined],
            ["key", "type", undefined],
            ["opentaggedunion", undefined],
            ["option", "value", undefined],
            ["openobject", "(", undefined],
            ["key", "type", undefined],
            ["opentaggedunion", undefined],
            ["option", "number", undefined],
            ["openobject", "(", undefined],
            ["closetaggedunion"],
            ["closeobject", ")", undefined],
            ["closetaggedunion"],
            ["closeobject", ")", undefined],
            ["closeobject", ")", undefined],
            ["key", "b", undefined],
            ["openobject", "(", undefined],
            ["key", "type", undefined],
            ["opentaggedunion", undefined],
            ["option", "value", undefined],
            ["openobject", "(", undefined],
            ["key", "type", undefined],
            ["opentaggedunion", undefined],
            ["option", "number", undefined],
            ["openobject", "(", undefined],
            ["closetaggedunion"],
            ["closeobject", ")", undefined],
            ["closetaggedunion"],
            ["closeobject", ")", undefined],
            ["closeobject", ")", undefined],
            ["key", "c", undefined],
            ["openobject", "(", undefined],
            ["key", "type", undefined],
            ["opentaggedunion", undefined],
            ["option", "value", undefined],
            ["openobject", "(", undefined],
            ["key", "type", undefined],
            ["opentaggedunion", undefined],
            ["option", "text", undefined],
            ["openobject", "(", undefined],
            ["closetaggedunion"],
            ["closeobject", ")", undefined],
            ["closetaggedunion"],
            ["closeobject", ")", undefined],
            ["closeobject", ")", undefined],
            ["closeobject", "}", undefined],
            ["closeobject", ")", undefined],
            ["closeobject", ")", undefined],
            ["closeobject", "}", undefined],
            ["key", "root type", undefined],
            ["quotedstring", "root", undefined],
            ["closeobject", ")", undefined],
            ["headerend"],
            ["openobject", "{", undefined],
            ["key", "a", undefined],
            ["quotedstring", "B", undefined],
            ["key", "b", undefined],
            ["quotedstring", "X", undefined],
            ["key", "c", undefined],
            ["quotedstring", "C", undefined],
            ["closeobject", "}", undefined],
            ["end", undefined],
        ],
    },
}
