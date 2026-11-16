# Chapters 11 & 12: Real-Time SSE Token Streaming & Multi-Node WebSockets

## Architectural Scope
- Server-Sent Events (SSE) endpoint optimized for LLM token streaming with sub-5ms chunk delivery.
- Fastify WebSocket server supporting client heartbeat, connection management, and group channels.
- Redis Pub/Sub cluster backplane enabling horizontal scaling across multiple stateless Fastify nodes.
