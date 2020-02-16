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
            ["unquotedstring", "1"],
            ["unquotedstring", "2"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "single line comment": {
        text: '[1,"a"//a comment\r\n]',
        parserOptions: {
            allow: { comments: true },
        },
        events: [
            ["openarray"],
            ["unquotedstring", "1"],
            ["quotedstring", "a"],
            ["linecomment", "a comment"],
            ["closearray"],
            ["end"],
            ["ready"],
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
            ["unquotedstring", "1"],
            ["quotedstring", "a"],
            ["blockcomment", "a comment\r\n"],
            ["closearray"],
            ["end"],
            ["ready"],
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
            ["unquotedstring", "1"],
            ["quotedstring", "a"],
            ["blockcomment", "a comment b * c"],
            ["closearray"],
            ["end"],
            ["ready"],
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
            ["ready"],
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
            ["ready"],
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
            ["ready"],
        ],
    },
    "apostrophe string": {
        text: "'a string'",
        parserOptions: {
            allow: { apostrophes_instead_of_quotation_marks: true },
        },
        events: [
            ["quotedstring", "a string", 1, 10],
            ["end"],
            ["ready"],
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
            ["ready"],
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
            ["unquotedstring", "5"],
            ["closetaggedunion"],
            ["end"],
            ["ready"],
        ],
    },
    "schema optional": {
        text: '!"a schema" 42',
        parserOptions: {
            allow: { schema: true },
        },
        events: [
            ["schemastart"],
            ["quotedstring", "a schema"],
            ["schemaend"],
            ["unquotedstring", "42"],
            ["end"],
            ["ready"],
        ],
    },
    "schema optional but not there": {
        text: "42",
        parserOptions: {
            allow: { schema: true },
        },
        events: [
            ["unquotedstring", "42"],
            ["end"],
            ["ready"],
        ],
    },
    "schema required but not there": {
        text: "42",
        parserOptions: {
            require: {
                schema: true,
            },
        },
        events: [
            ["parsererror"],
            ["unquotedstring", "42"],
            ["ready"],
        ],
    },
    "schema required": {
        text: '! "a schema" 42',
        parserOptions: {
            require: {
                schema: true,
            },
        },
        events: [
            ["schemastart"],
            ["quotedstring", "a schema"],
            ["schemaend"],
            ["unquotedstring", "42"],
            ["end"],
            ["ready"],
        ],
    },
}
