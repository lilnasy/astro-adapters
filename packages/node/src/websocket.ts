import type * as ws from 'ws';

/**
 * Custom subclass because spec-compliant Response objects can't have a status of 101.
 */
export class UpgradeResponse extends Response {
	readonly status = 101
}

export class WebSocket extends EventTarget implements globalThis.WebSocket {
    
    // the half-web-compatible WebSocket implementation of "ws"
    #ws: ws.WebSocket | undefined
    
    static attach(standard: WebSocket, ws: ws.WebSocket) {
        if (standard.#ws) {
            throw new Error("WebSocket already attached")
        }
        
        standard.#ws = ws
        
        ws.binaryType = "arraybuffer"

        if (ws.readyState === ws.OPEN) {
            const event = new Event("open")
            standard.onopen?.(event)
            standard.dispatchEvent(event)
        }

        ws.addEventListener("open", () => {
            const event = new Event("open")
            standard.onopen?.(event)
            standard.dispatchEvent(event)
        })
        ws.addEventListener("message", ev => {
            const event = new MessageEvent("message", ev) 
            standard.onmessage?.(event)
            standard.dispatchEvent(event)
        })
        ws.addEventListener("error", ev => {
            const event = new ErrorEvent(ev.error, ev.message)
            standard.onerror?.(event)
            standard.dispatchEvent(event)
        })
        ws.addEventListener("close", ev => {
            const event = new CloseEvent("close", ev)
            standard.onclose?.(event)
            standard.dispatchEvent(event)
        })
        
        return standard
    }

    // WHATWG WebSocket doesnt do "nodebuffer", ws.WebSocket doesnt do "blob"
    // leaving only "arraybuffer" as the only common type 
    readonly binaryType = "arraybuffer" as const
    
    get bufferedAmount() {
        return this.#ws?.bufferedAmount ?? 0
    }

    get extensions() {
        return this.#ws?.extensions ?? ''
    }

    get protocol() {
        return this.#ws?.protocol ?? ''
    }

    get readyState() {
        return this.#ws?.readyState ?? this.CONNECTING
    }

    get url() {
        return this.#ws?.url ?? ''
    }

    static readonly CONNECTING = 0 as const
    static readonly OPEN       = 1 as const
    static readonly CLOSING    = 2 as const
    static readonly CLOSED     = 3 as const

    readonly CONNECTING = 0 as const
    readonly OPEN       = 1 as const
    readonly CLOSING    = 2 as const
    readonly CLOSED     = 3 as const
    
    onopen    : globalThis.WebSocket["onopen"]    = null
    onmessage : globalThis.WebSocket["onmessage"] = null
    onerror   : globalThis.WebSocket["onerror"]   = null
    onclose   : globalThis.WebSocket["onclose"]   = null

    close() {
        this.#ws!.close()
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (data instanceof Blob) data.arrayBuffer().then(buffer => this.#ws!.send(buffer))
        else this.#ws!.send(data)
    }
}

export class ErrorEvent extends Event {
    constructor(readonly error: string, readonly message: string) {
        super("error")
    }
}

export class CloseEvent extends Event implements globalThis.CloseEvent {
    readonly code: number
    readonly reason: string
    readonly wasClean: boolean

    constructor(type: string, eventInitDict: CloseEventInit) {
        super(type, eventInitDict)
        this.code = eventInitDict.code ?? 0
        this.reason = eventInitDict.reason ?? ""
        this.wasClean = eventInitDict.wasClean ?? false
    }
}
