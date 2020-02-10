import { TestDefinitions } from "./testDefinition";


export const extensionTests: TestDefinitions = {
    trailing_comma: {
        text: '[1,2,]',
        options: {
            allow: { trailing_commas: true, }
        },
        events: [
            ["openarray", undefined],
            ["simplevalue", 1],
            ["simplevalue", 2],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined]
        ]
    },
    single_line_comment: {
        text: '[1,"a"//a comment\r\n]',
        options: {
            allow: { comments: true, }
        },
        events: [
            ["openarray", undefined],
            ["simplevalue", 1],
            ["simplevalue", "a"],
            ["linecomment", "a comment"],
            ["closearray", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    multi_line_comment: {
        text: '[1,"a"/*a comment\r\n*/]',
        options: {
            allow: { comments: true, }
        },
        events: [
            ["openarray", undefined],
            ["simplevalue", 1],
            ["simplevalue", "a"],
            ["blockcomment", "a comment\r\n*"],
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
            ["simplevalue", "foo"],
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
            ["simplevalue", "foo"],
            ["simplevalue", "bar"],
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
            ["simplevalue", "foo"],
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
            ["simplevalue", "a string", 1, 10],
            ["end", undefined],
            ["ready", undefined],
        ],
    },
    typed_union: {
        text: '| "foo" "x"',
        options: {
            allow: {
                typed_unions: true,
            }
        },
        events: [
            ["opentypedunion", undefined],
            ["option", "foo"],
            ["simplevalue", "x"],
            ["closetypedunion", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    typed_union_with_number_at_end: {
        text: '| "foo" 5',
        options: {
            allow: {
                typed_unions: true,
            }
        },
        events: [
            ["opentypedunion", undefined],
            ["option", "foo"],
            ["simplevalue", 5],
            ["closetypedunion", undefined],
            ["end", undefined],
            ["ready", undefined],
        ]
    },
    schema_optional: {
        text: '!"a schema" 42',
        options: {
            allow: { schema_reference: true}
        },
        events: [
            ["schemareference", "a schema"],
            ["simplevalue", 42],
            ["end", undefined],
            ["ready", undefined],
        ],
    },
    schema_optional_but_not_there: {
        text: "42",
        options: {
            allow: { schema_reference: true}
        },
        events: [
            ["simplevalue", 42],
            ["end", undefined],
            ["ready", undefined],
        ],
    },
    schema_required_but_not_there: {
        text: "42",
        options: {
            require_schema_reference:true
        },
        events: [
            ["error", undefined],
            ["error", undefined],
        ],
    },
    schema_required: {
        text: '! "a schema" 42',
        options: {
           require_schema_reference: true
        },
        events: [
            ["schemareference", "a schema"],
            ["simplevalue", 42],
            ["end", undefined],
            ["ready", undefined],
        ],
    },
}
