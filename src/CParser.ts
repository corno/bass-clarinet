const env: any = (typeof process === 'object' && process.env)
  ? process.env
  : self

export function parser(opt?: Options) { return new CParser(opt) }
export const MAX_BUFFER_LENGTH = 64 * 1024
export const DEBUG = (env.CDEBUG === 'debug')
export const INFO = (env.CDEBUG === 'debug' || env.CDEBUG === 'info')

function assertUnreachable(_x: never) {
  throw new Error("unreachable")
}

export type Options = {
  trim?: boolean
  normalize?: boolean
}

enum GlobalStateType {
  STRING,
  NUMBER,
  KEYWORD,
  OTHER,
}

enum OtherState {
  EXPECTING_ROOTVALUE, // value at the root
  END, // no more input expected

  EXPECTING_OBJECTVALUE, // value in object
  EXPECTING_KEY_OR_OBJECT_END,
  EXPECTING_COMMA_OR_OBJECT_END, // , or }
  EXPECTING_KEY, // "a"
  EXPECTING_COLON, // :

  EXPECTING_ARRAYVALUE, // value in array
  EXPECTING_VALUE_OR_ARRAY_END,
  EXPECTING_COMMA_OR_ARRAY_END, // , or ]
}

enum LiteralState {
  TRUE, // r
  TRUE2, // u
  TRUE3, // e

  FALSE, // a
  FALSE2, // l
  FALSE3, // s
  FALSE4, // e

  NULL, // u
  NULL2, // l
  NULL3, // l
}

type GlobalState =
  | [GlobalStateType.NUMBER, {
    numberNode: string
    nextState: OtherState
    expectingDecimalPoint: boolean
  }]
  | [GlobalStateType.KEYWORD, {
    nextState: OtherState
    state: LiteralState
  }]
  | [GlobalStateType.STRING, {
    textNode: string
    stringType: StringType
    nextState: OtherState
    unicodeI: number //= 0
    unicodeS: string //null
    slashed: boolean // = false
  }]
  | [GlobalStateType.OTHER, OtherStateData]

type OtherStateData = {
  state: OtherState
}

function getStateDescription(s: GlobalState) {
  switch (s[0]) {
    case GlobalStateType.NUMBER: return "NUMBER"
    case GlobalStateType.STRING: return "STRING"
    case GlobalStateType.KEYWORD: {
      switch (s[1].state) {
        case LiteralState.TRUE: return "TRUE"
        case LiteralState.TRUE2: return "TRUE2"
        case LiteralState.TRUE3: return "TRUE3"
        case LiteralState.FALSE: return "FALSE"
        case LiteralState.FALSE2: return "FALSE2"
        case LiteralState.FALSE3: return "FALSE3"
        case LiteralState.FALSE4: return "FALSE4"
        case LiteralState.NULL: return "NULL"
        case LiteralState.NULL2: return "NULL2"
        case LiteralState.NULL3: return "NULL3"
      }
    }
    case GlobalStateType.OTHER: {

      switch (s[1].state) {
        case OtherState.END: return "END"
        case OtherState.EXPECTING_ROOTVALUE: return "EXPECTING_ROOTVALUE"
        case OtherState.EXPECTING_OBJECTVALUE: return "EXPECTING_OBJECTVALUE"
        case OtherState.EXPECTING_ARRAYVALUE: return "EXPECTING_ARRAYVALUE"
        case OtherState.EXPECTING_KEY_OR_OBJECT_END: return "EXPECTING_KEY_OR_OBJECT_END"
        case OtherState.EXPECTING_COMMA_OR_OBJECT_END: return "EXPECTING_COMMA_OR_OBJECT_END"
        case OtherState.EXPECTING_VALUE_OR_ARRAY_END: return "EXPECTING_VALUE_OR_ARRAY_END"
        case OtherState.EXPECTING_COMMA_OR_ARRAY_END: return "EXPECTING_COMMA_OR_ARRAY_END"
        case OtherState.EXPECTING_KEY: return "EXPECTING_KEY"
        case OtherState.EXPECTING_COLON: return "EXPECTING_COLON"
      }
    }
  }
}

enum StringType {
  KEY,
  VALUE,
}

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

enum ContextType {
  ROOT,
  OBJECT,
  ARRAY,
}

class Subscribers<T> {
  subscribers = new Array<(t: T) => void>()
  signal(t: T) {
    this.subscribers.forEach(s => s(t))
  }
  subscribe(subscriber: (t: T) => void) {
    this.subscribers.push(subscriber)
  }
}

type Event =
  | "ready"
  | "end"
  | "error"
  | "openobject"
  | "closeobject"
  | "openarray"
  | "closearray"
  | "key"
  | "value"


const stringTokenPattern = /[\\"\n]/g

export class CParser {

  bufferCheckPosition = MAX_BUFFER_LENGTH
  q = ""
  c = 0
  pChar: number = 0
  closed = false
  closedRoot = false
  readonly opt: Options
  sawRoot = false
  tag = null
  error: null | Error = null
  state: GlobalState = [GlobalStateType.OTHER, {
    state: OtherState.EXPECTING_ROOTVALUE
  }]

  readonly stack = new Array<ContextType>()
  // mostly just for error reporting
  position = 0
  column = 0
  line = 1


  onend = new Subscribers<void>()
  onerror = new Subscribers<Error>()
  onclosearray = new Subscribers<void>()
  onopenarray = new Subscribers<void>()
  oncloseobject = new Subscribers<void>()
  onopenobject = new Subscribers<void>()
  onkey = new Subscribers<string>()
  onvalue = new Subscribers<string | boolean | null | number>()
  onready = new Subscribers<void>()

  currentContext = ContextType.ROOT

  constructor(opt?: Options) {
    this.opt = opt || {}
    if (INFO) console.log('-- emit', "onready")
    this.onready.signal()
  }

  public subscribe(event: Event, subscriber: (data?: any) => void) {
    switch (event) {
      case "closearray":
        this.onclosearray.subscribers.push(subscriber)
        break
      case "openarray":
        this.onopenarray.subscribers.push(subscriber)
        break
      case "closeobject":
        this.oncloseobject.subscribers.push(subscriber)
        break
      case "openobject":
        this.onopenobject.subscribers.push(subscriber)
        break
      case "end":
        this.onend.subscribers.push(subscriber)
        break
      case "value":
        this.onvalue.subscribers.push(subscriber)
        break
      case "ready":
        this.onready.subscribers.push(subscriber)
        break
      case "error":
        this.onerror.subscribers.push(subscriber)
        break
      case "key":
        this.onkey.subscribers.push(subscriber)
        break
      default:
        assertUnreachable(event)
    }
  }

  private handleError(er: string) {
    er += `
    Line: ${this.line}
    Column: ${this.column}
    Char: '${String.fromCharCode(this.c)}'
    Char#: ${this.c}`
    const error = new Error(er)
    this.error = error
    this.onerror.signal(error)
    return this
  }
  public write(chunk: string | null) {
    if (this.error) throw this.error
    if (this.closed) return this.handleError(
      "Cannot write after close. Assign an onready handler.")
    if (chunk === null) return this.end()
    let i = 0
    let c = chunk.charCodeAt(0)
    let p = this.pChar
    if (DEBUG) console.log('write -> [' + chunk + ']')
    while (c) {
      p = c
      this.c = c = chunk.charCodeAt(i++)
      // if chunk doesnt have next, like streaming char by char
      // this way we need to check if previous is really previous
      // if not we need to reset to what the parser says is the previous
      // from buffer
      if (p !== c) this.pChar = p
      else p = this.pChar

      if (!c) break

      if (DEBUG) console.log(i, c, getStateDescription(this.state))
      this.position++
      if (c === Char.lineFeed) {
        this.line++
        this.column = 0
      } else this.column++
      const st = this.state
      switch (st[0]) {
        case GlobalStateType.NUMBER: {
          const $ = st[1]

          if ($.numberNode === "-0" || $.numberNode === "0") {
            if (c !== Char.period && c !== Char.e && c !== Char.E && c !== Char.comma && c !== Char.closeBrace && c !== Char.closeBracket) {
              this.handleError(`Leading zero not followed by '.', 'e', 'E', ',' ']' or '}'`)
            }
          }

          if (Char._0 <= c && c <= Char._9) {
            $.numberNode += String.fromCharCode(c)
          } else if (c === Char.period) {
            if ($.numberNode.indexOf('.') !== -1) {
              this.handleError('Invalid number, has two dots')
            }
            $.numberNode += "."
          } else if (c === Char.e || c === Char.E) {
            if ($.numberNode.indexOf('e') !== -1 ||
              $.numberNode.indexOf('E') !== -1)
              this.handleError('Invalid number has two exponential')
            $.numberNode += "e"
          } else if (c === Char.plus || c === Char.minus) {
            if (!(p === Char.e || p === Char.E))
              this.handleError('Invalid symbol in number')
            $.numberNode += String.fromCharCode(c)
          } else {
            if ($.numberNode)
              this.onvalue.signal(parseFloat($.numberNode))
            i-- // go back one
            this.state = [GlobalStateType.OTHER, { state: $.nextState }]
          }
          //   continue
          continue
        }
        case GlobalStateType.STRING: {
          const $ = st[1]

          if ($.textNode === undefined) {
            $.textNode = ""
          }

          // thanks thejh, this is an about 50% performance improvement.
          let starti = i - 1
            , slashed = $.slashed
            , unicodeI = $.unicodeI

          STRING_BIGLOOP: while (true) {
            if (DEBUG)
              console.log(i, c, getStateDescription(this.state)
                , slashed)
            // zero means "no unicode active". 1-4 mean "parse some more". end after 4.
            while (unicodeI > 0) {
              $.unicodeS += String.fromCharCode(c)
              c = chunk.charCodeAt(i++)
              this.position++
              if (unicodeI === 4) {
                // TODO this might be slow? well, probably not used too often anyway
                $.textNode += String.fromCharCode(parseInt($.unicodeS, 16))
                unicodeI = 0
                starti = i - 1
              } else {
                unicodeI++
              }
              // we can just break here: no stuff we skipped that still has to be sliced out or so
              if (!c) break STRING_BIGLOOP
            }
            if (c === Char.doubleQuote && !slashed) {
              $.textNode += chunk.substring(starti, i - 1)

              const textNode = textopts(this.opt, $.textNode)
              if ($.stringType === StringType.KEY) {
                this.onkey.signal(textNode)
              } else {
                this.onvalue.signal(textNode)
              }



              this.state = [GlobalStateType.OTHER, { state: $.nextState }]
              this.position += i - 1 - starti
              break
            }
            if (c === Char.backslash && !slashed) {
              slashed = true
              $.textNode += chunk.substring(starti, i - 1)
              this.position += i - 1 - starti
              c = chunk.charCodeAt(i++)
              this.position++
              if (!c) break
            }
            if (slashed) {
              slashed = false
              if (c === Char.n) { $.textNode += '\n' }
              else if (c === Char.r) { $.textNode += '\r' }
              else if (c === Char.t) { $.textNode += '\t' }
              else if (c === Char.f) { $.textNode += '\f' }
              else if (c === Char.b) { $.textNode += '\b' }
              else if (c === Char.u) {
                // \uxxxx. meh!
                unicodeI = 1
                $.unicodeS = ''
              } else {
                $.textNode += String.fromCharCode(c)
              }
              c = chunk.charCodeAt(i++)
              this.position++
              starti = i - 1
              if (!c) break
              else continue
            }

            stringTokenPattern.lastIndex = i
            const reResult = stringTokenPattern.exec(chunk)
            if (reResult === null) {
              i = chunk.length + 1
              $.textNode += chunk.substring(starti, i - 1)
              this.position += i - 1 - starti
              break
            }
            i = reResult.index + 1
            c = chunk.charCodeAt(reResult.index)
            if (!c) {
              $.textNode += chunk.substring(starti, i - 1)
              this.position += i - 1 - starti
              break
            }
          }
          $.slashed = slashed
          $.unicodeI = unicodeI
          continue
        }
        case GlobalStateType.KEYWORD: {
          const $ = st[1]
          switch ($.state) {

            case LiteralState.TRUE:
              if (c === Char.r) $.state = LiteralState.TRUE2
              else this.handleError('Invalid true started with t' + c)
              continue

            case LiteralState.TRUE2:
              if (c === Char.u) $.state = LiteralState.TRUE3
              else this.handleError('Invalid true started with tr' + c)
              continue

            case LiteralState.TRUE3:
              if (c === Char.e) {
                this.finishKeyword(true, $.nextState)
              } else this.handleError('Invalid true started with tru' + c)
              continue

            case LiteralState.FALSE:
              if (c === Char.a) $.state = LiteralState.FALSE2
              else this.handleError('Invalid false started with f' + c)
              continue

            case LiteralState.FALSE2:
              if (c === Char.l) $.state = LiteralState.FALSE3
              else this.handleError('Invalid false started with fa' + c)
              continue

            case LiteralState.FALSE3:
              if (c === Char.s) $.state = LiteralState.FALSE4
              else this.handleError('Invalid false started with fal' + c)
              continue

            case LiteralState.FALSE4:
              if (c === Char.e) {
                this.finishKeyword(false, $.nextState)
              } else this.handleError('Invalid false started with fals' + c)
              continue

            case LiteralState.NULL:
              if (c === Char.u) $.state = LiteralState.NULL2
              else this.handleError('Invalid null started with n' + c)
              continue

            case LiteralState.NULL2:
              if (c === Char.l) $.state = LiteralState.NULL3
              else this.handleError('Invalid null started with nu' + c)
              continue

            case LiteralState.NULL3:
              if (c === Char.l) {
                this.finishKeyword(null, $.nextState)
              } else this.handleError('Invalid null started with nul' + c)
              continue
            default: assertUnreachable($.state)
              continue
          }
        }
        case GlobalStateType.OTHER: {
          const $ = st[1]
          switch ($.state) {

            case OtherState.EXPECTING_KEY:
              if (isWhitespace(c)) continue
              this.processKey(c)
              continue
            case OtherState.EXPECTING_KEY_OR_OBJECT_END:
              if (isWhitespace(c)) continue

              if (c === Char.closeBrace) {
                this.oncloseobject.signal()
                this.pop($)
                continue
              } else {
                this.processKey(c)
              }
              continue

            case OtherState.EXPECTING_COLON:
              if (isWhitespace(c)) continue
              //const event = (parser.state === S.CLOSE_KEY) ? 'key' : 'object'
              if (c === Char.colon) {
                $.state = OtherState.EXPECTING_OBJECTVALUE
                // } else if (c === Char.closeBrace) {
                //   this.emitNode('oncloseobject')
                //   this.depth--
                //   $.state = this.stack.pop() || State.END
                // } else if (c === Char.comma) {
                //   $.state = State.OPEN_KEY
              } else this.handleError(`Expected colon, found ${String.fromCharCode(c)}`)
              continue
            case OtherState.EXPECTING_COMMA_OR_OBJECT_END:
              if (isWhitespace(c)) continue
              //const event = (parser.state === S.CLOSE_KEY) ? 'key' : 'object'
              if (c === Char.closeBrace) {
                this.oncloseobject.signal()

                this.pop($)
              } else if (c === Char.comma) {
                $.state = OtherState.EXPECTING_KEY
              } else this.handleError(`Expected ',' or '}', found ${String.fromCharCode(c)}`)
              continue

            case OtherState.EXPECTING_VALUE_OR_ARRAY_END: // after an array there always a value
              if (isWhitespace(c)) continue
              if (c === Char.closeBracket) {
                this.onclosearray.signal()
                this.pop($)
                continue
              } else {
                this.processValue(c, OtherState.EXPECTING_COMMA_OR_ARRAY_END)
              }
              continue
            case OtherState.EXPECTING_ROOTVALUE:
              if (isWhitespace(c)) continue
              this.processValue(c, OtherState.END)
              continue
            case OtherState.EXPECTING_OBJECTVALUE:
              if (isWhitespace(c)) continue
              this.processValue(c, OtherState.EXPECTING_COMMA_OR_OBJECT_END)
              continue
            case OtherState.EXPECTING_ARRAYVALUE:
              if (isWhitespace(c)) continue
              this.processValue(c, OtherState.EXPECTING_COMMA_OR_ARRAY_END)
              continue
            case OtherState.EXPECTING_COMMA_OR_ARRAY_END:
              if (isWhitespace(c)) {
                continue
              }
              if (c === Char.comma) {
                $.state = OtherState.EXPECTING_ARRAYVALUE
              } else if (c === Char.closeBracket) {
                this.onclosearray.signal()
                this.pop($)
              }
              else {
                this.handleError(`Bad array, expected ',' or ']'`)
              }
              continue

            case OtherState.END: {
              if (isWhitespace(c)) {
                continue
              }
              this.handleError(`Unexpected data after end`)
              continue
            }
            default:
              assertUnreachable($.state)
              continue
          }
        }
        default: assertUnreachable(st[0])
      }
    }
    if (this.position >= this.bufferCheckPosition)
      this.checkBufferLength()
    return this
  }
  public resume() {
    this.error = null
    return this
  }
  public close() {
    return this.write(null)
  }
  private finishKeyword(value: false | true | null, nextState: OtherState) {

    this.onvalue.signal(value)
    this.state = [GlobalStateType.OTHER, { state: nextState }]
  }
  private checkBufferLength() {
    const maxAllowed = Math.max(MAX_BUFFER_LENGTH, 10)
    let maxActual = 0
    const x = (buffer?: string) => {

      const len = buffer === undefined ? 0 : buffer.length
      if (len > maxAllowed) {
        switch (buffer) {
          case "text":
            throw new Error("missing implementation for 'closeText'")
            //closeText(parser)
            break

          default:
            this.handleError("Max buffer length exceeded: " + buffer)
        }
      }
      maxActual = Math.max(maxActual, len)
    }
    switch (this.state[0]) {
      case GlobalStateType.NUMBER:
        x(this.state[1].numberNode)
        break
      case GlobalStateType.STRING:
        x(this.state[1].textNode)
        break
    }
    this.bufferCheckPosition = (MAX_BUFFER_LENGTH - maxActual)
      + this.position
  }
  public end() {
    if (this.state[0] !== GlobalStateType.OTHER || this.state[1].state !== OtherState.END || this.stack.length !== 0)
      this.handleError("Unexpected end")

    this.c = 0
    this.closed = true
    this.onend.signal()

    //CParser.call(parser, parser.opt)
    //return parser
  }
  private initString(stringType: StringType, nextState: OtherState) {
    this.state = [GlobalStateType.STRING, {
      textNode: "",
      stringType: stringType,
      nextState: nextState,
      unicodeI: 0,
      unicodeS: "",
      slashed: false
    }]
  }
  private pop(st: OtherStateData) {
    const popped = this.stack.pop()
    if (popped === undefined) {
      this.handleError("unexpected end of stack")
    } else {
      this.currentContext = popped
      switch (popped) {
        case ContextType.ARRAY:
          st.state = OtherState.EXPECTING_COMMA_OR_ARRAY_END
          break
        case ContextType.OBJECT:
          st.state = OtherState.EXPECTING_COMMA_OR_OBJECT_END
          break
        case ContextType.ROOT:
          st.state = OtherState.END
          break
      }
    }
  }
  private processKey(c: number) {
    if (c === Char.doubleQuote) {
      this.initString(StringType.KEY, OtherState.EXPECTING_COLON)
    } else this.handleError(`Malformed object, key should start with '"'`)
  }
  private processValue(c: number, nextState: OtherState) {
    if (c === Char.doubleQuote) {
      this.initString(StringType.VALUE, nextState)
    }
    else if (c === Char.openBrace) {
      this.state = [GlobalStateType.OTHER, { state: OtherState.EXPECTING_KEY_OR_OBJECT_END }]
      this.onopenobject.signal()
      this.stack.push(this.currentContext)
      this.currentContext = ContextType.OBJECT

    } else if (c === Char.openBracket) {
      this.state = [GlobalStateType.OTHER, { state: OtherState.EXPECTING_VALUE_OR_ARRAY_END }]
      this.onopenarray.signal()

      this.stack.push(this.currentContext)
      this.currentContext = ContextType.ARRAY

    }
    else if (c === Char.t) this.state = [GlobalStateType.KEYWORD, { state: LiteralState.TRUE, nextState: nextState }]
    else if (c === Char.f) this.state = [GlobalStateType.KEYWORD, { state: LiteralState.FALSE, nextState: nextState }]
    else if (c === Char.n) this.state = [GlobalStateType.KEYWORD, { state: LiteralState.NULL, nextState: nextState }]
    else if (c === Char.minus) {
      this.state = [GlobalStateType.NUMBER, {
        numberNode: String.fromCharCode(c),
        nextState: nextState,
        expectingDecimalPoint: false,
      }]
    } else if (Char._0 <= c && c <= Char._9) {
      this.state = [GlobalStateType.NUMBER, {
        numberNode: String.fromCharCode(c),
        nextState: nextState,
        expectingDecimalPoint: c === Char._0,
      }]
    } else this.handleError("Bad value")
  }


}



function textopts(opt: Options, text: string) {
  if (text === undefined) {
    return text
  }
  if (opt.trim) text = text.trim()
  if (opt.normalize) text = text.replace(/\s+/g, " ")
  return text
}



function isWhitespace(c: number) {
  return c === Char.carriageReturn || c === Char.lineFeed || c === Char.space || c === Char.tab
}

