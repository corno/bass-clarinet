/* eslint-disable no-console */
const { Suite } = require("benchmark");
const { Listener } = require("./listener");
const oldClarinet = require("clarinet");
const newClarinet = require("..");

const oldParser = oldClarinet.parser();
const oldListener = new Listener(oldParser);

const newParser = newClarinet.parser();
const newListener = new Listener(newParser);

const suites =
  ["creationix", "npm", "twitter", "wikipedia"]
    .map((name) => {
      // eslint-disable-next-line security/detect-non-literal-require
      return { name, json: JSON.stringify(require(`../samples/${name}.json`)) };
    });

for (const { name, json } of suites) {
  new Suite("name")
    // Uncomment the below to add node's native JSON parsing to the results:
    // .add(`native-${name}`, () => JSON.parse(json))
    .add(`old-${name}`, () => {
      oldListener.reset();
      oldParser.write(json);
      oldParser.close();
      oldListener.check();
    })
    .add(`new-${name}`, () => {
      newListener.reset();
      newParser.write(json);
      newParser.close();
      newListener.check();
    })
    .on("cycle", (event) => {
      console.log(String(event.target));
    })
    .on("error", (event) => {
      console.error(String(event.target.error));
    })
    .on("complete", (event) => {
      console.log(
        `Fastest is ${event.currentTarget.filter("fastest").map("name")}\n`
      );
    })
    .run();
}
