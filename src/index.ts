import { Env } from './types';
import { errorHandler } from './utils/errorHandler';

export default {
	async fetch(request: Request, env: Env) {
		// Authorization Key Validation
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || authHeader !== `Bearer ${env.AUTH_KEY}`) {
			return new Response('Unauthorized', {
				status: 401,
			});
		}

		// Extract payload from the request
		const payload = await request.text();

		// Validate payload if it's a POST request
		if (request.method === 'POST') {
			try {
				const data = JSON.parse(payload);

				if (data.length === 0) {
					return new Response(null, {
						status: 400,
						statusText: JSON.stringify({
							jsonrpc: "2.0",
							id: null,
							error: { code: -32600, message: "empty rpc batch" },
						}),
					});
				}
			} catch (e) {
				return new Response(null, {
					status: 400,
					statusText: JSON.stringify({
						jsonrpc: "2.0",
						id: null,
						error: { code: -32700, message: "failed to parse RPC request body" },
					}),
				});
			}
		}

		// Parse the RPC_ENDPOINTS environment variable
		let rpcEndpoints;
		try {
			rpcEndpoints = JSON.parse(env.RPC_ENDPOINTS);
		} catch (e) {
			console.error("Failed to parse RPC_ENDPOINTS:", e);
			return new Response(null, {
				status: 500,
				statusText: "Invalid RPC_ENDPOINTS format",
			});
		}

		// Send requests to all RPC endpoints concurrently
		await Promise.all(
			rpcEndpoints.map(({ url, headers = {} }) => {
				// Merge default proxy headers with custom headers from the environment variable
				const proxyHeaders = {
					'Content-Type': 'application/json',
					//'X-Helius-Cloudflare-Proxy': 'true',
					//...corsHeaders,
					...headers, // Custom headers specific to this endpoint
				};

				//if (origin && !headers.Origin) {
				//	proxyHeaders['Origin'] = origin;
				//}

				if (!proxyHeaders['User-Agent']) {
					proxyHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0';
				}

				return fetch(url, {
					method: request.method,
					body: payload || null,
					headers: proxyHeaders,
				}).catch((err) => {
					// Handle individual request errors
					console.error(`Failed to send request to ${url}:`, err);
				});
			})
		);

		// Return a simple response, indicating that the requests were forwarded
		return new Response(null, {
			status: 204,  // No Content
			//headers: corsHeaders,
		});
	},
};
