import * as ws from 'ws';
import { NodeApp } from 'astro/app/node';
import { UpgradeResponse, WebSocket } from './websocket.js';

type UpgradeHandler =
    import("node:http").Server["on"] extends
        (event: "upgrade", callback: infer UpgradeHandler) => unknown
            ? UpgradeHandler
            : never

export function createWebsocketHandler(app: NodeApp): UpgradeHandler {
    const server = new ws.WebSocketServer({ noServer: true })
    return async (req, socket, head) => {
        /*
         * The websocket instance is created as soon as locals.upgradeWebSocket() is called.
         * It gets attached to an actual connection once the app code returns a response.
         */
        let websocket: WebSocket

        const response = await app.render(NodeApp.createRequest(req), {
            addCookieHeader: true,
            locals: {
                async upgradeWebSocket() {
                    websocket = new WebSocket
                    return { socket: websocket, response: new UpgradeResponse }
                }
            }
        })

        if (response instanceof UpgradeResponse) {
            server.handleUpgrade(req, socket, head, ws => WebSocket.attach(websocket, ws))
        } else {
            /* The "upgrade" event callback doesn't provide a response object.
             * The http data must be directly streamed into the lower level socket.
             * Abruptly closing the connection altogether, as we do here, is a
             * substitute for manually writing out the HTTP text for rejecting
             * the request.
             */
            socket.destroy()
        }
	}
}
