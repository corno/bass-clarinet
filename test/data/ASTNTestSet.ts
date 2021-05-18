/* eslint
    camelcase:"off",
*/
import { TestDefinitions } from "../TestDefinition";


export const extensionTests: TestDefinitions = {
    "trailing comma": {
        text: '[ 1, 2, ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "unquotedtoken", "2", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "line comment": {
        text: '[ 1, "a" //a line comment\r\n]',
        formattedText: '[ 1, "a" //a line comment\n]',
        skipRoundTripCheck: false,
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "quotedstring", "a", null],
            ["token", "linecomment", "a line comment", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "block comment": {
        text: '[ 1, "a" /*a comment\t\t\n\t\t*/ ]',
        formattedText: '[ 1, "a" /*a comment\n*/ ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "quotedstring", "a", null],
            ["token", "blockcomment", "a comment\t\t\n\t\t", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "block comment 2": {
        text: '[ 1, "a" /*a comment b * c*/ ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "unquotedtoken", "1", null],
            ["token", "quotedstring", "a", null],
            ["token", "blockcomment", "a comment b * c", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "block comment 3": {
        text: `[
    "A"
            /*
            a comment
            */
        ]`,
        formattedText: `[
    "A"
    /*
    a comment
    */
]`,
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "A", null],
            ["token", "blockcomment", "\n            a comment\n            ", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "block comment 4": {
        text: `[
    "A"
/*
a comment
    an indented comment line
        an extra indented comment line
*/
        ]`,
        formattedText: `[
    "A"
    /*
    a comment
        an indented comment line
            an extra indented comment line
    */
]`,
    },
    "parens instead of braces": {
        text: '( "a": "foo" )',
        events: [
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "a", null],
            ["token", "quotedstring", "foo", null],
            ["token", "closeobject", ")", null],
            ["end", null],
        ],
    },
    "open paren and close curly": {
        text: '( "a": "foo" }',
        events: [
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "a", null],
            ["token", "quotedstring", "foo", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "missing comma": {
        text: '[ "foo" "bar" ]',
        events: [
            ["token", "openarray", "[", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "bar", null],
            ["token", "closearray", "]", null],
            ["end", null],
        ],
    },
    "angle brackets instead of brackets": {
        text: '< "foo" >',
        events: [
            ["token", "openarray", "<", null],
            ["token", "quotedstring", "foo", null],
            ["token", "closearray", ">", null],
            ["end", null],
        ],
    },
    "apostrophe string": {
        text: "'a string'",
        testForLocation: true,
        events: [
            ["token", "quotedstring", "a string", [1, 1, 1, 11]],
            ["end", [1, 11]],
        ],
    },
    "tagged union": {
        text: '| "foo" "x"',
        events: [
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "x", null],
            ["end", null],
        ],
    },
    "incomplete tagged union": {
        text: '| "foo"',
        events: [
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "foo", null],
            ["parsingerror", "unexpected end of document, still in tagged union"],
            ["end", null],
            ["stacked error", "missing value"],
            ["stacked error", "unexpected end of document, still in tagged union"],
        ],
    },
    "incomplete tagged union in object": {
        text: '( "a": | "foo" )',
        events: [
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "a", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "foo", null],
            ["token", "closeobject", ")", null],
            ["parsingerror", "not in an object"],
            ["parsingerror", "unexpected end of document, still in tagged union"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["end", null],
            ["stacked error", "missing value"],
            ["stacked error", "missing tagged union value"],
        ],
    },
    "incomplete tagged union in object 2": {
        text: '( "a": | )',
        events: [
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "a", null],
            ["token", "opentaggedunion", null],
            ["token", "closeobject", ")", null],
            ["parsingerror", "not in an object"],
            ["parsingerror", "unexpected end of document, still in tagged union"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["end", null],
            ["stacked error", "missing tagged union option and value"],
        ],
    },
    "tagged union with number at end": {
        text: '| "foo" 5',
        events: [
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "foo", null],
            ["token", "unquotedtoken", "5", null],
            ["end", null],
        ],
    },
    "tagged union with string at end": {
        text: '| "foo" "a string"',
        events: [
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "foo", null],
            ["token", "quotedstring", "a string", null],
            ["end", null],
        ],
    },
    "tagged union with missing data": {
        text: '{ "bla": | "foo" //comment\n}',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "bla", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "foo", null],
            ["token", "linecomment", "comment", null],
            ["token", "closeobject", "}", null],
            ["parsingerror", "not in an object"],
            ["parsingerror", "unexpected end of document, still in tagged union"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["end", null],
            ["stacked error", "missing value"],
            ["stacked error", "missing tagged union value"],
        ],
    },
    "double tagged union with missing data": {
        text: '{ "bla": | "foo" | "bar" }',
        events: [
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "bla", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "foo", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "bar", null],
            ["token", "closeobject", "}", null],
            ["parsingerror", "not in an object"],
            ["parsingerror", "unexpected end of document, still in tagged union"],
            ["parsingerror", "unexpected end of document, still in tagged union"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["end", null],
            ["stacked error", "missing value"],
            ["stacked error", "missing tagged union value"],
        ],
    },
    "schema": {
        text: '!"a schema" 42',
        testHeaders: true,
        events: [
            ["token", "schema data start"],
            ["token", "quotedstring", "a schema", null],
            ["end", null],
            ["instance data start", false],
            ["token", "unquotedtoken", "42", null],
            ["end", null],
        ],
    },
    "schema 2": {
        text: '!"a schema" ( )',
        testHeaders: true,
        events: [
            ["token", "schema data start"],
            ["token", "quotedstring", "a schema", null],
            ["end", null],
            ["instance data start", false],
            ["token", "openobject", "(", null],
            ["token", "closeobject", ")", null],
            ["end", null],
        ],
    },
    "schema optional but not there": {
        text: "42",
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "unquotedtoken", "42", null],
            ["end", null],
        ],
    },
    "schema required": {
        text: '!"a schema" 42',
        testHeaders: true,
        events: [
            ["token", "schema data start"],
            ["token", "quotedstring", "a schema", null],
            ["end", null],
            ["instance data start", false],
            ["token", "unquotedtoken", "42", null],
            ["end", null],
        ],
    },
    "internal schema": {
        text: `!(
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
){
    "a": "B"
    "b": "X"
    "c": "C"
}`,
        testHeaders: true,
        events: [
            ["token", "schema data start"],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "component types", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "root", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "node", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "properties", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "a1", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "value", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "number", null],
            ["token", "openobject", "(", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", ")", null],
            ["token", "quotedstring", "b", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "value", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "number", null],
            ["token", "openobject", "(", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", ")", null],
            ["token", "quotedstring", "c", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "value", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "text", null],
            ["token", "openobject", "(", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", "}", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", ")", null],
            ["token", "closeobject", "}", null],
            ["token", "quotedstring", "root type", null],
            ["token", "quotedstring", "root", null],
            ["token", "closeobject", ")", null],
            ["end", null],
            ["instance data start", false],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "a", null],
            ["token", "quotedstring", "B", null],
            ["token", "quotedstring", "b", null],
            ["token", "quotedstring", "X", null],
            ["token", "quotedstring", "c", null],
            ["token", "quotedstring", "C", null],
            ["token", "closeobject", "}", null],
            ["end", null],
        ],
    },
    "invalid internal schema": {
        text: `!(
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
)`,
        testHeaders: true,
        events: [
            ["token", "schema data start"],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "component types", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "x", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "node", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "properties", null],
            ["token", "openobject", "{", null],
            ["token", "quotedstring", "foo", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "value", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "number", null],
            ["token", "closeobject", ")", null],
            ["parsingerror", "not in an object"],
            ["token", "closeobject", ")", null],
            ["parsingerror", "not in an object"],
            ["token", "quotedstring", "bar", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "taggedunion", null],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "type", null],
            ["token", "opentaggedunion", null],
            ["token", "quotedstring", "number", null],
            ["token", "closeobject", ")", null],
            ["parsingerror", "not in an object"],
            ["token", "closeobject", ")", null],
            ["parsingerror", "not in an object"],
            ["token", "closeobject", "}", null],
            ["parsingerror", "not in an object"],
            ["token", "closeobject", ")", null],
            ["parsingerror", "not in an object"],
            ["token", "closeobject", ")", null],
            ["parsingerror", "not in an object"],
            ["token", "closeobject", "}", null],
            ["parsingerror", "not in an object"],
            ["token", "quotedstring", "root type", null],
            ["token", "quotedstring", "x", null],
            ["token", "closeobject", ")", null],
            ["parsingerror", "missing property value"],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "foov", null],
            ["token", "unquotedtoken", "42", null],
            ["token", "closeobject", ")", null],
            ["parsingerror", "unexpected end of document, still in object"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["parsingerror", "unexpected end of document, still in tagged union"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["parsingerror", "unexpected end of document, still in object"],
            ["end", null],
            ["instance data start", false],
            ["end", null],
            ["stacked error", "missing value"],
        ],
    },
    "comment": {
        text: `//a comment
(
    "y": /*should be a number*/ true
)`,
        testHeaders: true,
        events: [
            ["token", "linecomment", "a comment", null],
            ["instance data start", false],
            ["token", "openobject", "(", null],
            ["token", "quotedstring", "y", null],
            ["token", "blockcomment", "should be a number", null],
            ["token", "unquotedtoken", "true", null],
            ["token", "closeobject", ")", null],
            ["end", null],
        ],
    },
    "empty type": {
        text: `(
)`,
        testHeaders: true,
        events: [
            ["instance data start", false],
            ["token", "openobject", "(", null],
            ["token", "closeobject", ")", null],
            ["end", null],
        ],
    },
}