/* eslint
    @typescript-eslint/camelcase: "off",
    camelcase:"off",
*/
import { TestDefinitions } from "./testDefinition";


export const extensionTests: TestDefinitions = {
    "trailing comma": {
        text: '[1,2,]',
        parserOptions: {
            allow: { trailing_commas: true },
        },
        events: [
            ["openarray"],
            ["unquotedtoken", "1"],
            ["unquotedtoken", "2"],
            ["closearray"],
            ["end"],
        ],
    },
    "single line comment": {
        text: '[1,"a"//a comment\r\n]',
        skipEqualityCheck: true,
        parserOptions: {
            allow: { comments: true },
        },
        events: [
            ["openarray"],
            ["unquotedtoken", "1"],
            ["quotedstring", "a"],
            ["linecomment", "a comment"],//FIX this location, [ 1, 7, 1, 18 ]],
            ["closearray"],
            ["end"],
        ],
    },
    "multi line comment": {
        text: '[1,"a"/*a comment\r\n*/]',
        parserOptions: {
            allow: {
                comments: true,
            },
        },
        events: [
            ["openarray"],
            ["unquotedtoken", "1"],
            ["quotedstring", "a"],
            ["blockcomment", "a comment\r\n", [1, 7, 2, 3]],
            ["closearray"],
            ["end"],
        ],
    },
    "multi line comment 2": {
        text: '[1,"a"/*a comment b * c*/]',
        parserOptions: {
            allow: {
                comments: true,
            },
        },
        events: [
            ["openarray"],
            ["unquotedtoken", "1"],
            ["quotedstring", "a"],
            ["blockcomment", "a comment b * c"],
            ["closearray"],
            ["end"],
        ],
    },
    "parens instead of braces": {
        text: '( "a": "foo" )',
        parserOptions: {
            allow: { parens_instead_of_braces: true },
        },
        events: [
            ["openobject", "("],
            ["key", "a"],
            ["quotedstring", "foo"],
            ["closeobject", ")"],
            ["end"],
        ],
    },
    "missing comma": {
        text: '["foo""bar"]',
        parserOptions: {
            allow: { missing_commas: true },
        },
        events: [
            ["openarray"],
            ["quotedstring", "foo"],
            ["quotedstring", "bar"],
            ["closearray"],
            ["end"],
        ],
    },
    "angle brackets instead of brackets": {
        text: '<"foo">',
        parserOptions: {
            allow: { angle_brackets_instead_of_brackets: true },
        },
        events: [
            ["openarray", "<"],
            ["quotedstring", "foo"],
            ["closearray", ">"],
            ["end"],
        ],
    },
    "apostrophe string": {
        text: "'a string'",
        parserOptions: {
            allow: { apostrophes_instead_of_quotation_marks: true },
        },
        events: [
            ["quotedstring", "a string", [1, 1, 1, 11]],
            ["end"],
        ],
    },
    "tagged union": {
        text: '| "foo" "x"',
        parserOptions: {
            allow: {
                tagged_unions: true,
            },
        },
        events: [
            ["opentaggedunion"],
            ["option", "foo"],
            ["quotedstring", "x"],
            ["closetaggedunion"],
            ["end"],
        ],
    },
    "tagged union with number at end": {
        text: '| "foo" 5',
        parserOptions: {
            allow: {
                tagged_unions: true,
            },
        },
        events: [
            ["opentaggedunion"],
            ["option", "foo"],
            ["unquotedtoken", "5"],
            ["closetaggedunion"],
            ["end"],
        ],
    },
    "schema optional": {
        text: '!"a schema" 42',
        parserOptions: {
            allow: { schema: true },
        },
        testHeaders: true,
        events: [
            ["headerstart"],
            ["quotedstring", "a schema"],
            ["headerend"],
            ["unquotedtoken", "42"],
            ["end"],
        ],
    },
    "schema optional but not there": {
        text: "42",
        testHeaders: true,
        parserOptions: {
            allow: { schema: true },
        },
        events: [
            ["headerend"],
            ["unquotedtoken", "42"],
            ["end"],
        ],
    },
    "schema required but not there": {
        text: "42",
        testHeaders: true,
        parserOptions: {
            require: {
                schema: true,
            },
        },
        events: [
            ["parsererror", 'expecting schema start (!)'],
            ["headerend"],
            ["unquotedtoken", "42"],
            ["end"],
        ],
    },
    "schema required but not there 2": {
        text: "{}",
        testHeaders: true,
        parserOptions: {
            require: {
                schema: true,
            },
        },
        events: [
            ["parsererror", 'expecting schema start (!)'],
            ["headerend"],
            ["openobject"],
            ["closeobject"],
            ["end"],
        ],
    },
    "schema required": {
        text: '! "a schema" 42',
        testHeaders: true,
        parserOptions: {
            require: {
                schema: true,
            },
        },
        events: [
            ["headerstart"],
            ["quotedstring", "a schema"],
            ["headerend"],
            ["unquotedtoken", "42"],
            ["end"],
        ],
    },
    "empty while expecting schema": {
        text: '',
        parserOptions: {
            require: {
                schema: true,
            },
        },
        events: [
            ["parsererror", "expected the schema start (!)"],
            ["end"],
        ],
    },
}
