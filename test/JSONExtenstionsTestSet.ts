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
            ["linecomment", "a comment", undefined],//FIX this location, [ 1, 7, 1, 18 ], undefined],
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
}
