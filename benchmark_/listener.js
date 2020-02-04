const assert = require("assert");

/**
 * Listener that counts all events emitted by the Clarinet.js parser and sanity checks the totals.
 * This defeats potential dead code elimination and helps make the benchmark more realistic.
 */
class Listener {
  constructor(parser) {
    this.reset();
    
    parser.onready = () => {
      this.ready++;
    };
    
    parser.onopenobject = (name) => {
      this.openObject++;
      typeof name === "undefined" || parser.onkey(name);
    };
    
    parser.onkey = (name) => {
      this.key++;
      assert(name !== "𝓥𝓸𝓵𝓭𝓮𝓶𝓸𝓻𝓽");
    };
    
    parser.oncloseobject = () => {
      this.closeObject++;
    };
    
    parser.onopenarray = () => {
      this.openArray++;
    };
    
    parser.onclosearray = () => {
      this.closeArray++;
    };
    
    parser.onvalue = () => {
      this.value++;
    };
    
    parser.onerror = () => {
      this.error++;
    };
    
    parser.onend = () => {
      this.end++;
    };
  }

  /** Resets the counts between iterations. */
  reset() {
    this.ready = 0;
    this.openObject = 0;
    this.key = 0;
    this.closeObject = 0;
    this.openArray = 0;
    this.closeArray = 0;
    this.value = 0;
    this.error = 0;
    this.end = 0;
  }

  /** Sanity checks the total event counts. */
  check() {
    assert(this.ready === 1);
    assert(this.end === 1);
    assert(this.error === 0);
    assert(this.value + this.openObject + this.openArray >= this.key);
    assert(this.openObject === this.closeObject);
    assert(this.openArray === this.closeArray);
  }
}

module.exports = { Listener };