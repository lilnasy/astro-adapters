import type { AstroAdapter, AstroIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import type { Options, UserOptions } from './types.js';
import * as ws from 'ws';
import { WebSocket, UpgradeResponse } from './websocket.js';

export interface Locals {
	upgradeWebSocket(): Promise<{ socket: WebSocket, response: Response }>;
}

interface NodeLocals extends Locals {}

declare global {
    namespace App {
        export interface Locals extends NodeLocals {}
    }
}

export function getAdapter(options: Options): AstroAdapter {
	return {
		name: '@astrojs/node',
		serverEntrypoint: '@astrojs/node/server.js',
		previewEntrypoint: '@astrojs/node/preview.js',
		exports: ['handler', 'startServer', 'options'],
		args: options,
		supportedAstroFeatures: {
			hybridOutput: 'stable',
			staticOutput: 'stable',
			serverOutput: 'stable',
			assets: {
				supportKind: 'stable',
				isSharpCompatible: true,
				isSquooshCompatible: true,
			},
			i18nDomains: 'experimental',
			envGetSecret: 'experimental',
		},
	};
}

// TODO: remove once we don't use a TLA anymore
async function shouldExternalizeAstroEnvSetup() {
	try {
		await import('astro/env/setup');
		return false;
	} catch {
		return true;
	}
}

export default function createIntegration(userOptions: UserOptions): AstroIntegration {
	if (!userOptions?.mode) {
		throw new AstroError(`Setting the 'mode' option is required.`);
	}

	let _options: Options;
	let viteDevServer: Parameters<NonNullable<AstroIntegration['hooks']['astro:server:setup']>>[0]['server'];
	return {
		name: '@astrojs/node',
		hooks: {
			'astro:config:setup': async ({ updateConfig, config }) => {
				updateConfig({
					image: {
						endpoint: config.image.endpoint ?? 'astro/assets/endpoint/node',
					},
					vite: {
						ssr: {
							noExternal: ['@astrojs/node'],
							...((await shouldExternalizeAstroEnvSetup())
								? {
										external: ['astro/env/setup'],
									}
								: {}),
						},
					},
				});
			},
			'astro:config:done': ({ setAdapter, config, logger }) => {
				_options = {
					...userOptions,
					client: config.build.client?.toString(),
					server: config.build.server?.toString(),
					host: config.server.host,
					port: config.server.port,
					assets: config.build.assets,
				};
				setAdapter(getAdapter(_options));

				if (config.output === 'static') {
					logger.warn(
						`\`output: "server"\` or  \`output: "hybrid"\` is required to use this adapter.`
					);
				}
			},
			'astro:server:setup' ({ server }) {
				viteDevServer = server
			},
			'astro:server:start' ({ logger }) {
				const astroDevHandler = viteDevServer.middlewares.stack.find(stackItem => (stackItem.handle as any).name === 'astroDevHandler')!.handle as (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void
				const server = new ws.WebSocketServer({ noServer: true })
				viteDevServer.httpServer?.on('upgrade', (req, socket, head) => {
					req[Symbol.for("astro.locals")] = {
						upgradeWebSocket() {
							const websocket = new WebSocket
							server.handleUpgrade(req, socket, head, ws => WebSocket.attach(websocket, ws))
							return { socket: websocket, response: new UpgradeResponse }
						}
					}
					astroDevHandler(req, fakeResponse)
				})
			}
		},
	};
}

const fakeResponse = {
	setHeader() {},
	write() {},
	writeHead() {},
	end() {},
	on() {},
} as any as import("node:http").ServerResponse