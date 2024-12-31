import type { Endpoint } from 'payload'

/**
 * Server-Sent Events (SSE) endpoint for Messages collection using TransformStream
 * Implements a polling mechanism to check for new messages and stream them to clients
 */
export const SSEMessages: Endpoint = {
  path: '/sse',
  method: 'get',
  handler: async (req) => {
    try {
      // Create abort controller to handle connection termination
      const abortController = new AbortController()
      const { signal } = abortController

      // Set up streaming infrastructure
      const stream = new TransformStream()
      const writer = stream.writable.getWriter()
      const encoder = new TextEncoder()

      // Initialize timestamp to fetch all messages from the beginning
      let lastTimestamp = new Date(0).toISOString()

      // Send keep-alive messages every 30 seconds to maintain connection
      const keepAlive = setInterval(async () => {
        if (!signal.aborted) {
          await writer.write(encoder.encode('event: ping\ndata: keep-alive\n\n'))
        }
      }, 30000)

      /**
       * Polls for new messages and sends them to connected clients
       * - Queries messages newer than the last received message
       * - Updates lastTimestamp to the newest message's timestamp
       * - Streams messages to client using SSE format
       */
      const pollMessages = async () => {
        if (!signal.aborted) {
          // Query for new messages since last update
          const messages = await req.payload.find({
            collection: 'messages',
            where: {
              updatedAt: { greater_than: lastTimestamp },
            },
            sort: '-updatedAt',
            limit: 10,
            depth: 1,
            populate: {
              users: {
                email: true,
              },
            },
          })

          if (messages.docs.length > 0) {
            // Update timestamp to latest message for next poll
            lastTimestamp = messages.docs[0].updatedAt
            // Send messages to client in SSE format
            await writer.write(
              encoder.encode(`event: message\ndata: ${JSON.stringify(messages.docs)}\n\n`),
            )
          }
        }
      }

      // Poll for new messages every second
      const messageInterval = setInterval(pollMessages, 1000)

      // Clean up intervals and close writer when connection is aborted
      signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        clearInterval(messageInterval)
        writer.close()
      })

      // Return SSE response with appropriate headers
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no', // Prevents nginx from buffering the response
          'Access-Control-Allow-Origin': '*', // CORS header for cross-origin requests
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    } catch (error) {
      console.log(error)
      return new Response('Error occurred', { status: 500 })
    }
  },
}
