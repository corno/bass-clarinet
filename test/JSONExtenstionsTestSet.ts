import { TestDefinitions } from "./testDefinition";


export const extensionTests: TestDefinitions = {
    trailing_comma: {
        text: '[1,2,]',
        options: {
            allow: { trailing_commas: true, }
        },
        events: [
            ["openarray", undefined],
            ["value", 1],
            ["value", 2],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    single_line_comment: {
        text: '[1,2//a comment\r\n]',
        options: {
            allow: { comments: true, }
        },
        events: [
            ["openarray", undefined],
            ["value", 1],
            ["value", 2],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    multi_line_comment: {
        text: '[1,2/*a comment\r\n*/]',
        options: {
            allow: { comments: true, }
        },
        events: [
            ["openarray", undefined],
            ["value", 1],
            ["value", 2],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    parens_instead_of_braces: {
        text: '( "a": "foo" )',
        options: {
            allow: { parens_instead_of_braces: true }
        },
        events: [
            ["openobject", "("],
            ["key", "a"],
            ["value", "foo"],
            ["closeobject", ")"],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    missing_comma: {
        text: '["foo""bar"]',
        options: {
            allow: { missing_commas: true}
        },
        events: [
            ["openarray", undefined],
            ["value", "foo"],
            ["value", "bar"],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    angle_brackets_instead_of_brackets: {
        text: '<"foo">',
        options: {
            allow: { angle_brackets_instead_of_brackets: true }
        },
        events: [
            ["openarray", "<"],
            ["value", "foo"],
            ["closearray", ">"],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    apostrophe_string: {
        text: "'a string'",
        options: {
            allow: {apostrophes_instead_of_quotation_marks: true}
        },
        events: [
            ["value", "a string", 1, 10],
            ["end", undefined],
            ["ready", undefined],
        ],
    },
}