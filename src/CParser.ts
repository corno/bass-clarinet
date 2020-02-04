const env: any = (typeof process === 'object' && process.env)
  ? process.env
  : self;

export function parser(opt?: Options) { return new CParser(opt); };
export const MAX_BUFFER_LENGTH = 64 * 1024;
export const DEBUG = (env.CDEBUG === 'debug');
export const INFO = (env.CDEBUG === 'debug' || env.CDEBUG === 'info');

export type Options = {
  trim?: boolean
  normalize?: boolean
}

let S: any = 0

let STATE: any =
{
  VALUE: S++ // general stuff
  , OPEN_OBJECT: S++ // {
  , CLOSE_OBJECT: S++ // }
  , OPEN_ARRAY: S++ // [
  , CLOSE_ARRAY: S++ // ]
  , TEXT_ESCAPE: S++ // \ stuff
  , STRING: S++ // ""
  , BACKSLASH: S++
  , END: S++ // No more stack
  , OPEN_KEY: S++ // , "a"
  , CLOSE_KEY: S++ // :
  , TRUE: S++ // r
  , TRUE2: S++ // u
  , TRUE3: S++ // e
  , FALSE: S++ // a
  , FALSE2: S++ // l
  , FALSE3: S++ // s
  , FALSE4: S++ // e
  , NULL: S++ // u
  , NULL2: S++ // l
  , NULL3: S++ // l
  , NUMBER_DECIMAL_POINT: S++ // .
  , NUMBER_DIGIT: S++ // [0-9]
};

for (const s_ in STATE) STATE[STATE[s_]] = s_;

// switcharoo
S = STATE;

const Char = {
  tab: 0x09,     // \t
  lineFeed: 0x0A,     // \n
  carriageReturn: 0x0D,     // \r
  space: 0x20,     // " "

  doubleQuote: 0x22,     // "
  plus: 0x2B,     // +
  comma: 0x2C,     // ,
  minus: 0x2D,     // -
  period: 0x2E,     // .

  _0: 0x30,     // 0
  _9: 0x39,     // 9

  colon: 0x3A,     // :

  E: 0x45,     // E

  openBracket: 0x5B,     // [
  backslash: 0x5C,     // \
  closeBracket: 0x5D,     // ]

  a: 0x61,     // a
  b: 0x62,     // b
  e: 0x65,     // e 
  f: 0x66,     // f
  l: 0x6C,     // l
  n: 0x6E,     // n
  r: 0x72,     // r
  s: 0x73,     // s
  t: 0x74,     // t
  u: 0x75,     // u

  openBrace: 0x7B,     // {
  closeBrace: 0x7D,     // }
}

export function clearBuffers(parser: CParser) {
  parser.textNode = undefined
  parser.numberNode = ""
}

const stringTokenPattern = /[\\"\n]/g;

export class CParser {

  bufferCheckPosition = MAX_BUFFER_LENGTH;
  q = ""
  c = 0
  pChar: number = 0;
  closed = false
  closedRoot = false
  opt: Options
  sawRoot = false;
  tag = null
  error = null;
  state = S.VALUE;
  stack = new Array();
  // mostly just for error reporting
  position = 0
  column = 0;
  line = 1;
  slashed = false;
  unicodeI = 0;
  unicodeS: string | null = null;
  depth = 0;

  textNode?: string
  numberNode?: string = ""

  onend?: ((...args: any[]) => void)
  onerror?: ((...args: any[]) => void)

  onclosearray?: ((...args: any[]) => void)
  onopenarray?: ((...args: any[]) => void)
  onopenobject?: ((...args: any[]) => void)
  oncloseobject?: ((...args: any[]) => void)
  onkey?: ((...args: any[]) => void)
  onvalue?: ((...args: any[]) => void)
  onstring?: ((...args: any[]) => void)
  onready?: ((...args: any[]) => void)

  constructor(opt?: Options) {
    this.opt = opt || {};

    clearBuffers(this);
    this.emit("onready");
  }
  end() { this.endx(); }

  private errorx(er: any) {
    const parser = this
    this.closeValue();
    er += "\nLine: " + parser.line +
      "\nColumn: " + parser.column +
      "\nChar: " + parser.c;
    er = new Error(er);
    parser.error = er;
    this.emit("onerror", er);
    return parser;
  }
  write(chunk: string | null) {
    if (this.error) throw this.error;
    if (this.closed) return this.errorx(
      "Cannot write after close. Assign an onready handler.");
    if (chunk === null) return this.endx();
    let i = 0
    let c = chunk.charCodeAt(0)
    let p = this.pChar;
    if (DEBUG) console.log('write -> [' + chunk + ']');
    while (c) {
      p = c;
      this.c = c = chunk.charCodeAt(i++);
      // if chunk doesnt have next, like streaming char by char
      // this way we need to check if previous is really previous
      // if not we need to reset to what the parser says is the previous
      // from buffer
      if (p !== c) this.pChar = p;
      else p = this.pChar;

      if (!c) break;

      if (DEBUG) console.log(i, c, STATE[this.state]);
      this.position++;
      if (c === Char.lineFeed) {
        this.line++;
        this.column = 0;
      } else this.column++;
      switch (this.state) {

        case S.OPEN_KEY:
        case S.OPEN_OBJECT:
          if (isWhitespace(c)) continue;
          if (this.state === S.OPEN_KEY) this.stack.push(S.CLOSE_KEY);
          else {
            if (c === Char.closeBrace) {
              this.emit('onopenobject');
              this.depth++;
              this.emit('oncloseobject');
              this.depth--;
              this.state = this.stack.pop() || S.VALUE;
              continue;
            } else this.stack.push(S.CLOSE_OBJECT);
          }
          if (c === Char.doubleQuote) this.state = S.STRING;
          else this.errorx("Malformed object key should start with \"");
          continue;

        case S.CLOSE_KEY:
        case S.CLOSE_OBJECT:
          if (isWhitespace(c)) continue;
          //const event = (parser.state === S.CLOSE_KEY) ? 'key' : 'object';
          if (c === Char.colon) {
            if (this.state === S.CLOSE_OBJECT) {
              this.stack.push(S.CLOSE_OBJECT);
              this.closeValue('onopenobject');
              this.depth++;
            } else this.closeValue('onkey');
            this.state = S.VALUE;
          } else if (c === Char.closeBrace) {
            this.emitNode('oncloseobject');
            this.depth--;
            this.state = this.stack.pop() || S.VALUE;
          } else if (c === Char.comma) {
            if (this.state === S.CLOSE_OBJECT)
              this.stack.push(S.CLOSE_OBJECT);
            this.closeValue();
            this.state = S.OPEN_KEY;
          } else this.errorx('Bad object');
          continue;

        case S.OPEN_ARRAY: // after an array there always a value
        case S.VALUE:
          if (isWhitespace(c)) continue;
          if (this.state === S.OPEN_ARRAY) {
            this.emit('onopenarray');
            this.depth++;
            this.state = S.VALUE;
            if (c === Char.closeBracket) {
              this.emit('onclosearray');
              this.depth--;
              this.state = this.stack.pop() || S.VALUE;
              continue;
            } else {
              this.stack.push(S.CLOSE_ARRAY);
            }
          }
          if (c === Char.doubleQuote) this.state = S.STRING;
          else if (c === Char.openBrace) this.state = S.OPEN_OBJECT;
          else if (c === Char.openBracket) this.state = S.OPEN_ARRAY;
          else if (c === Char.t) this.state = S.TRUE;
          else if (c === Char.f) this.state = S.FALSE;
          else if (c === Char.n) this.state = S.NULL;
          else if (c === Char.minus) { // keep and continue
            this.numberNode += "-";
          } else if (Char._0 <= c && c <= Char._9) {
            this.numberNode += String.fromCharCode(c);
            this.state = S.NUMBER_DIGIT;
          } else this.errorx("Bad value");
          continue;

        case S.CLOSE_ARRAY:
          if (c === Char.comma) {
            this.stack.push(S.CLOSE_ARRAY);
            this.closeValue('onvalue');
            this.state = S.VALUE;
          } else if (c === Char.closeBracket) {
            this.emitNode('onclosearray');
            this.depth--;
            this.state = this.stack.pop() || S.VALUE;
          } else if (isWhitespace(c))
            continue;
          else this.errorx('Bad array');
          continue;

        case S.STRING:
          if (this.textNode === undefined) {
            this.textNode = "";
          }

          // thanks thejh, this is an about 50% performance improvement.
          let starti = i - 1
            , slashed = this.slashed
            , unicodeI = this.unicodeI
            ;
          STRING_BIGLOOP: while (true) {
            if (DEBUG)
              console.log(i, c, STATE[this.state]
                , slashed);
            // zero means "no unicode active". 1-4 mean "parse some more". end after 4.
            while (unicodeI > 0) {
              this.unicodeS += String.fromCharCode(c);
              c = chunk.charCodeAt(i++);
              this.position++;
              if (unicodeI === 4) {
                // TODO this might be slow? well, probably not used too often anyway
                this.textNode += String.fromCharCode(parseInt(this.unicodeS!, 16));
                unicodeI = 0;
                starti = i - 1;
              } else {
                unicodeI++;
              }
              // we can just break here: no stuff we skipped that still has to be sliced out or so
              if (!c) break STRING_BIGLOOP;
            }
            if (c === Char.doubleQuote && !slashed) {
              this.state = this.stack.pop() || S.VALUE;
              this.textNode += chunk.substring(starti, i - 1);
              this.position += i - 1 - starti;
              break;
            }
            if (c === Char.backslash && !slashed) {
              slashed = true;
              this.textNode += chunk.substring(starti, i - 1);
              this.position += i - 1 - starti;
              c = chunk.charCodeAt(i++);
              this.position++;
              if (!c) break;
            }
            if (slashed) {
              slashed = false;
              if (c === Char.n) { this.textNode += '\n'; }
              else if (c === Char.r) { this.textNode += '\r'; }
              else if (c === Char.t) { this.textNode += '\t'; }
              else if (c === Char.f) { this.textNode += '\f'; }
              else if (c === Char.b) { this.textNode += '\b'; }
              else if (c === Char.u) {
                // \uxxxx. meh!
                unicodeI = 1;
                this.unicodeS = '';
              } else {
                this.textNode += String.fromCharCode(c);
              }
              c = chunk.charCodeAt(i++);
              this.position++;
              starti = i - 1;
              if (!c) break;
              else continue;
            }

            stringTokenPattern.lastIndex = i;
            const reResult = stringTokenPattern.exec(chunk);
            if (reResult === null) {
              i = chunk.length + 1;
              this.textNode += chunk.substring(starti, i - 1);
              this.position += i - 1 - starti;
              break;
            }
            i = reResult.index + 1;
            c = chunk.charCodeAt(reResult.index);
            if (!c) {
              this.textNode += chunk.substring(starti, i - 1);
              this.position += i - 1 - starti;
              break;
            }
          }
          this.slashed = slashed;
          this.unicodeI = unicodeI;
          continue;

        case S.TRUE:
          if (c === Char.r) this.state = S.TRUE2;
          else this.errorx('Invalid true started with t' + c);
          continue;

        case S.TRUE2:
          if (c === Char.u) this.state = S.TRUE3;
          else this.errorx('Invalid true started with tr' + c);
          continue;

        case S.TRUE3:
          if (c === Char.e) {
            this.emit("onvalue", true);
            this.state = this.stack.pop() || S.VALUE;
          } else this.errorx('Invalid true started with tru' + c);
          continue;

        case S.FALSE:
          if (c === Char.a) this.state = S.FALSE2;
          else this.errorx('Invalid false started with f' + c);
          continue;

        case S.FALSE2:
          if (c === Char.l) this.state = S.FALSE3;
          else this.errorx('Invalid false started with fa' + c);
          continue;

        case S.FALSE3:
          if (c === Char.s) this.state = S.FALSE4;
          else this.errorx('Invalid false started with fal' + c);
          continue;

        case S.FALSE4:
          if (c === Char.e) {
            this.emit("onvalue", false);
            this.state = this.stack.pop() || S.VALUE;
          } else this.errorx('Invalid false started with fals' + c);
          continue;

        case S.NULL:
          if (c === Char.u) this.state = S.NULL2;
          else this.errorx('Invalid null started with n' + c);
          continue;

        case S.NULL2:
          if (c === Char.l) this.state = S.NULL3;
          else this.errorx('Invalid null started with nu' + c);
          continue;

        case S.NULL3:
          if (c === Char.l) {
            this.emit("onvalue", null);
            this.state = this.stack.pop() || S.VALUE;
          } else this.errorx('Invalid null started with nul' + c);
          continue;

        case S.NUMBER_DECIMAL_POINT:
          if (c === Char.period) {
            this.numberNode += ".";
            this.state = S.NUMBER_DIGIT;
          } else this.errorx('Leading zero not followed by .');
          continue;

        case S.NUMBER_DIGIT:
          if (Char._0 <= c && c <= Char._9) this.numberNode += String.fromCharCode(c);
          else if (c === Char.period) {
            if (this.numberNode!.indexOf('.') !== -1)
              this.errorx('Invalid number has two dots');
            this.numberNode += ".";
          } else if (c === Char.e || c === Char.E) {
            if (this.numberNode!.indexOf('e') !== -1 ||
              this.numberNode!.indexOf('E') !== -1)
              this.errorx('Invalid number has two exponential');
            this.numberNode += "e";
          } else if (c === Char.plus || c === Char.minus) {
            if (!(p === Char.e || p === Char.E))
              this.errorx('Invalid symbol in number');
            this.numberNode += String.fromCharCode(c);
          } else {
            if (this.numberNode)
              this.emit("onvalue", parseFloat(this.numberNode));
            this.numberNode = "";
            i--; // go back one
            this.state = this.stack.pop() || S.VALUE;
          }
          continue;

        default:
          this.errorx("Unknown state: " + this.state);
      }
    }
    if (this.position >= this.bufferCheckPosition)
      this.checkBufferLength();
    return this;
  }
  resume() { this.error = null; return this; }
  close() { return this.write(null); }
  private checkBufferLength() {
    const maxAllowed = Math.max(MAX_BUFFER_LENGTH, 10)
    let maxActual = 0
    const x = (buffer?: string) => {
  
      const len = buffer === undefined ? 0 : buffer.length;
      if (len > maxAllowed) {
        switch (buffer) {
          case "text":
            throw new Error("missing implementation for 'closeText'")
            //closeText(parser);
            break;
  
          default:
            this.errorx("Max buffer length exceeded: " + buffer);
        }
      }
      maxActual = Math.max(maxActual, len);
    }
    const parser = this
    x(parser.textNode)
    x(parser.numberNode)
    parser.bufferCheckPosition = (MAX_BUFFER_LENGTH - maxActual)
      + parser.position;
  }
  private endx() {
    const parser = this
    if (parser.state !== S.VALUE || parser.depth !== 0)
      this.errorx("Unexpected end");
  
    this.closeValue();
    parser.c = 0;
    parser.closed = true;
    this.emit("onend");
    //CParser.call(parser, parser.opt);
    //return parser;
  }
  

private emit(event: string, data?: any) {
  if (INFO) console.log('-- emit', event, data);
  const prsr: any = parser
  if (prsr[event]) prsr[event](data);
}

private emitNode(event: string, data?: any) {
  this.closeValue();
  this.emit(event, data);
}

private closeValue(event?: any) {
  const parser = this
  parser.textNode = textopts(parser.opt, parser.textNode!);
  if (parser.textNode !== undefined) {
    this.emit((event ? event : "onvalue"), parser.textNode);
  }
  parser.textNode = undefined;
}
}



function textopts(opt: Options, text: string) {
  if (text === undefined) {
    return text;
  }
  if (opt.trim) text = text.trim();
  if (opt.normalize) text = text.replace(/\s+/g, " ");
  return text;
}



function isWhitespace(c: number) {
  return c === Char.carriageReturn || c === Char.lineFeed || c === Char.space || c === Char.tab;
}

