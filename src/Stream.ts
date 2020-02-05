import { Stream } from "stream"
import { Parser, Options } from "./Parser"

export const EVENTS: AnyEvent[] =
    ["value"
        , "key"
        , "openobject"
        , "closeobject"
        , "openarray"
        , "closearray"
        , "error"
        , "end"
        , "ready"
    ]

type Event =
    | "value"
    | "key"
    | "openobject"
    | "closeobject"
    | "openarray"
    | "closearray"
    | "ready"


type AnyEvent =
    | "end"
    | "error"
    | Event

export function createStream(opt: any) { return new CStream(opt) }

function assertUnreachable(_x: never) {
    throw new Error("unreachable")
}

export class CStream extends Stream {

    parser: Parser
    writable = true
    readable = true

    //const Buffer = this.Buffer || function Buffer () {} // if we don't have Buffers, fake it so we can do `const instanceof Buffer` and not throw an error
    bytes_remaining = 0 // number of bytes remaining in multi byte utf8 char to read after split boundary
    bytes_in_sequence = 0 // bytes in multi byte utf8 char to read
    temp_buffs = [, new Buffer(2), new Buffer(3), new Buffer(4)] // for rebuilding chars split before boundary is reached
    string = ''

    constructor(opt: Options) {
        super()
        this.parser = new Parser(opt)

        Stream.apply(this)

        this.parser.subscribe("end", () => { this.emit("end") })
        this.parser.subscribe("error", (er: any) => {
            this.emit("error", er)
            //this.parser.error = null
        })
        const me = this

        const parser: any = me.parser

        const streamWraps: Event[] = ["value"
            , "key"
            , "openobject"
            , "closeobject"
            , "openarray"
            , "closearray"
            , "ready"
        ]
        streamWraps.forEach(function (ev) {
            Object.defineProperty(me, "on" + ev,
                {
                    get: function () { return parser["on" + ev] }
                    , set: function (h) {
                        if (!h) {
                            me.removeAllListeners(ev)
                            parser["on" + ev] = h
                            return h
                        }
                        me.on(ev, h)
                    }
                    , enumerable: true
                    , configurable: false
                })
        })
    }
    write(data: any): void | true {
        data = new Buffer(data)
        for (let i = 0; i < data.length; i++) {
            const n = data[i]

            // check for carry over of a multi byte char split between data chunks
            // & fill temp buffer it with start of this data chunk up to the boundary limit set in the last iteration
            if (this.bytes_remaining > 0) {
                for (var j = 0; j < this.bytes_remaining; j++) {
                    this.temp_buffs[this.bytes_in_sequence]![this.bytes_in_sequence - this.bytes_remaining + j] = data[j]
                }
                this.string = this.temp_buffs[this.bytes_in_sequence]!.toString()
                this.bytes_in_sequence = this.bytes_remaining = 0

                // move iterator forward by number of byte read during sequencing
                i = i + j - 1

                // pass data to parser and move forward to parse rest of data
                this.parser.write(this.string)
                this.emit("data", this.string)
                continue
            }

            // if no remainder bytes carried over, parse multi byte (>=128) chars one at a time
            if (this.bytes_remaining === 0 && n >= 128) {
                if ((n >= 194) && (n <= 223)) this.bytes_in_sequence = 2
                if ((n >= 224) && (n <= 239)) this.bytes_in_sequence = 3
                if ((n >= 240) && (n <= 244)) this.bytes_in_sequence = 4
                if ((this.bytes_in_sequence + i) > data.length) { // if bytes needed to complete char fall outside data length, we have a boundary split

                    for (let k = 0; k <= (data.length - 1 - i); k++) {
                        this.temp_buffs[this.bytes_in_sequence]![k] = data[i + k] // fill temp data of correct size with bytes available in this chunk
                    }
                    this.bytes_remaining = (i + this.bytes_in_sequence) - data.length

                    // immediately return as we need another chunk to sequence the character
                    return true
                } else {
                    this.string = data.slice(i, (i + this.bytes_in_sequence)).toString()
                    i = i + this.bytes_in_sequence - 1

                    this.parser.write(this.string)
                    this.emit("data", this.string)
                    continue
                }
            }

            // is there a range of characters that are immediately parsable?
            for (var p = i; p < data.length; p++) {
                if (data[p] >= 128) break
            }
            this.string = data.slice(i, p).toString()
            this.parser.write(this.string)
            this.emit("data", this.string)
            i = p - 1

            // handle any remaining characters using multibyte logic
            continue
        }
    }

    end(chunk?: string) {
        if (chunk && chunk.length) this.parser.write(chunk.toString())
        this.parser.end()
        return true
    }

    on(ev: Event, handler: (...args: any[]) => void): this {
        const me = this
        switch (ev) {
            case "key":
                this.parser.subscribe("key", (key: string) => { this.emit("key", key) })
                break
            case "value":
                this.parser.subscribe("value", (value: any) => { this.emit("value", value) })
                break
            case "openarray":
                this.parser.subscribe("openarray", () => { this.emit("openarray") })
                break
            case "closearray":
                this.parser.subscribe("closearray", () => { this.emit("closearray") })
                break
            case "openobject":
                this.parser.subscribe("openobject", (key: any) => { this.emit("openobject", key) })
                break
            case "closeobject":
                this.parser.subscribe("closeobject", () => { this.emit("closeobject") })
                break
            case "ready":
                this.parser.subscribe("ready", () => { this.emit("ready") })
                break
            default: assertUnreachable(ev)
        }
        return super.on.call(me, ev, handler)
    }

    destroy() {
        //this._parser.state = [GlobalState:OTHER, { state: ??? }]
        this.emit("close")
    }


}