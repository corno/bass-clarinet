import { TestDefinitions } from "./testDefinition";


export const extensionTests: TestDefinitions = {
    "trailing comma": {
        text: '[1,2,]',
        options: {
            allow: { trailing_commas: true },
        },
        events: [
            ["openarray"],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "single_line_comment": {
        text: '[1,"a"//a comment\r\n]',
        options: {
            allow: { comments: true },
        },
        events: [
            ["openarray"],
            ["simplevalue", 1],
            ["simplevalue", "a"],
            ["linecomment", "a comment"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "multi_line_comment": {
        text: '[1,"a"/*a comment\r\n*/]',
        options: {
            allow: {
                comments: true,
            },
        },
        events: [
            ["openarray"],
            ["simplevalue", 1],
            ["simplevalue", "a"],
            ["blockcomment", "a comment\r\n"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "parens_instead_of_braces": {
        text: '( "a": "foo" )',
        options: {
            allow: { parens_instead_of_braces: true },
        },
        events: [
            ["openobject", "("],
            ["key", "a"],
            ["simplevalue", "foo"],
            ["closeobject", ")"],
            ["end"],
            ["ready"],
        ],
    },
    "missing_comma": {
        text: '["foo""bar"]',
        options: {
            allow: { missing_commas: true },
        },
        events: [
            ["openarray"],
            ["simplevalue", "foo"],
            ["simplevalue", "bar"],
            ["closearray"],
            ["end"],
            ["ready"],
        ],
    },
    "angle_brackets_instead_of_brackets": {
        text: '<"foo">',
        options: {
            allow: { angle_brackets_instead_of_brackets: true },
        },
        events: [
            ["openarray", "<"],
            ["simplevalue", "foo"],
            ["closearray", ">"],
            ["end"],
            ["ready"],
        ],
    },
    "apostrophe_string": {
        text: "'a string'",
        options: {
            allow: { apostrophes_instead_of_quotation_marks: true },
        },
        events: [
            ["simplevalue", "a string", 1, 10],
            ["end"],
            ["ready"],
        ],
    },
    "tagged_union": {
        text: '| "foo" "x"',
        options: {
            allow: {
                tagged_unions: true,
            },
        },
        events: [
            ["opentaggedunion"],
            ["option", "foo"],
            ["simplevalue", "x"],
            ["closetaggedunion"],
            ["end"],
            ["ready"],
        ],
    },
    "tagged_union_with_number_at_end": {
        text: '| "foo" 5',
        options: {
            allow: {
                tagged_unions: true,
            },
        },
        events: [
            ["opentaggedunion"],
            ["option", "foo"],
            ["simplevalue", 5],
            ["closetaggedunion"],
            ["end"],
            ["ready"],
        ],
    },
    "schema_optional": {
        text: '!"a schema" 42',
        options: {
            allow: { schema: true },
        },
        events: [
            ["schemastart"],
            ["simplevalue", "a schema"],
            ["schemaend"],
            ["simplevalue", 42],
            ["end"],
            ["ready"],
        ],
    },
    "schema_optional_but_not_there": {
        text: "42",
        options: {
            allow: { schema: true },
        },
        events: [
            ["simplevalue", 42],
            ["end"],
            ["ready"],
        ],
    },
    "schema_required_but_not_there": {
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
    "schema_required": {
        text: '! "a schema" 42',
        options: {
            require: {
                schema: true,
            },
        },
        events: [
            ["schemastart"],
            ["simplevalue", "a schema"],
            ["schemaend"],
            ["simplevalue", 42],
            ["end"],
            ["ready"],
        ],
    },
}
