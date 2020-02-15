/* eslint
    @typescript-eslint/camelcase: "off",
    camelcase:"off",
*/
import { TestDefinitions } from "./testDefinition";


export const extensionTests: TestDefinitions = {
    "trailing comma": {
        text: '[1,2,]',
        options: {
            allow: { trailing_commas: true },
        },
        events: [
            ["openarray"],
            ["number", "1"],
            ["number", "2"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "single line comment": {
        text: '[1,"a"//a comment\r\n]',
        options: {
            allow: { comments: true },
        },
        events: [
            ["openarray"],
            ["number", "1"],
            ["quotedstring", "a"],
            ["linecomment", "a comment"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "multi line comment": {
        text: '[1,"a"/*a comment\r\n*/]',
        options: {
            allow: {
                comments: true,
            },
        },
        events: [
            ["openarray"],
            ["number", "1"],
            ["quotedstring", "a"],
            ["blockcomment", "a comment\r\n"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "parens instead of braces": {
        text: '( "a": "foo" )',
        options: {
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
        options: {
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
        options: {
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
        options: {
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
        options: {
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
        options: {
            allow: {
                tagged_unions: true,
            },
        },
        events: [
            ["opentaggedunion"],
            ["option", "foo"],
            ["number", "5"],
            ["closetaggedunion"],
            ["end"],
            ["ready"],
        ],
    },
    "schema optional": {
        text: '!"a schema" 42',
        options: {
            allow: { schema: true },
        },
        events: [
            ["schemastart"],
            ["quotedstring", "a schema"],
            ["schemaend"],
            ["number", "42"],
            ["end"],
            ["ready"],
        ],
    },
    "schema optional but not there": {
        text: "42",
        options: {
            allow: { schema: true },
        },
        events: [
            ["number", "42"],
            ["end"],
            ["ready"],
        ],
    },
    "schema required but not there": {
        text: "42",
        options: {
            require: {
                schema: true,
            },
        },
        events: [
            ["error"],
        ],
    },
    "schema required": {
        text: '! "a schema" 42',
        options: {
            require: {
                schema: true,
            },
        },
        events: [
            ["schemastart"],
            ["quotedstring", "a schema"],
            ["schemaend"],
            ["number", "42"],
            ["end"],
            ["ready"],
        ],
    },
}
