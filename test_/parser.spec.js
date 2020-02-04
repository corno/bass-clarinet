"use strict";

const { parser } = require("..");
const assert = require("assert");

/**
 * TestListener uses the events emitted by the Clarinet.js parser to rebuild the original object.
 * It is convenient for writing tests that work by 'deepEqual()' comparing the result with the
 * result from 'JSON.parse()'.
 */
class TestListener {
  constructor(parser) {
    this.reset();

    parser.onready = () => {
      this.previousStates.length = 0;
      this.currentState.container.length = 0;
    };

    parser.onopenobject = (name) => {
      this.openContainer({});
      typeof name === "undefined" || parser.onkey(name);
    };

    parser.onkey = (name) => {
      this.currentState.key = name;
    };

    parser.oncloseobject = () => {
      this.closeContainer();
    };

    parser.onopenarray = () => {
      this.openContainer([]);
    };

    parser.onclosearray = () => {
      this.closeContainer();
    };

    parser.onvalue = (value) => {
      this.pushOrSet(value);
    };

    parser.onerror = (error) => {
      throw error;
    };

    parser.onend = () => {
      this.result = this.currentState.container.pop();
    };
  }

  reset() {
    this.result = void 0;
    this.previousStates = [];
    this.currentState = Object.freeze({ container: [], key: null });
  }

  pushOrSet(value) {
    const { container, key } = this.currentState;
    if (key !== null) {
      // eslint-disable-next-line security/detect-object-injection
      container[key] = value;
      this.currentState.key = null;
    } else {
      container.push(value);
    }
  }

  openContainer(newContainer) {
    this.pushOrSet(newContainer);
    this.previousStates.push(this.currentState);
    this.currentState = { container: newContainer, key: null };
  }

  closeContainer() {
    this.currentState = this.previousStates.pop();
  }
}

// tslint:disable:object-literal-sort-keys
const literalCases = [
  { type: "null", cases: ["null"] },
  { type: "boolean", cases: ["true", "false"] },
  { type: "integer", cases: ["0", "9007199254740991", "-9007199254740991"] },
  {
    type: "real",
    cases: [
      "1E1",
      "0.1e1",
      "1e-1",
      "1e+00",
      JSON.stringify(Number.MAX_VALUE),
      JSON.stringify(Number.MIN_VALUE),
    ]
  }
];
// tslint:enable:object-literal-sort-keys

const stringLiterals = [
  ["empty", JSON.stringify("")],
  ["space", JSON.stringify(" ")],
  ["quote", JSON.stringify("\"")],
  ["backslash", JSON.stringify("\\")],
  ["slash", "\"/ & \\/\""],
  ["control", JSON.stringify("\b\f\n\r\t")],
  ["unicode", JSON.stringify("\u0022")],
  ["non-unicode", JSON.stringify("&#34; %22 0x22 034 &#x22;")],
  ["surrogate", "\"😀\""],
];

const arrayLiterals = [
  "[]",
  "[null]",
  "[true, false]",
  "[0,1, 2,  3,\n4]",
  "[[\"2 deep\"]]",
];

const objectLiterals = [
  "{}",
  "\n {\n \"\\b\"\n :\n\"\"\n }\n ",
  "{\"\":\"\"}",
  "{\"1\":{\"2\":\"deep\"}}",
];

const parse = (json) => {
  const p = parser();
  const sink = new TestListener(p);
  p.write(json);
  p.close();
  return sink.result;
};

const test = (json, description) => {
  const expected = JSON.parse(json);
  it(`${JSON.stringify(json)} -> ${JSON.stringify(expected)}${
    description
      ? ` (${description})`
      : ""
  }`, () => {
    const actual = parse(json);
    assert.deepStrictEqual(actual, expected);
  });
};

for (const cases of literalCases) {
  describe(`${cases.type} literal`, () => {
    for (const json of cases.cases) {
      stringLiterals.push([`quoted ${cases.type}`, `"${json}"`]);
      // Clarinet does not current support (null | boolean | number | string) as root value.
      // To work around this, we wrap the literal in an array before passing to 'test()'.
      // (See: https://github.com/dscape/clarinet/issues/49)
      test(`[${json}]`);
    }
  });
}

describe("string literal", () => {
  for (const [description, json] of stringLiterals) {
      // Clarinet does not current support (null | boolean | number | string) as root value.
      // To work around this, we wrap the literal in an array before passing to 'test()'.
      // (See: https://github.com/dscape/clarinet/issues/49)
      test(`[${json}]`, description);
  }
});

describe("array literal", () => {
  for (const json of arrayLiterals) {
    test(json);
  }
});

describe("object literal", () => {
  for (const json of objectLiterals) {
    test(json);
  }
});
