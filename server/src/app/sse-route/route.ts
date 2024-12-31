import { broadcaster } from '@/lib/messageBroadcaster'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Add OPTIONS handler for CORS preflight requests
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*', // Or your specific domain
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  })
}

export async function GET() {
  console.log('[SSE] New connection request')

  // Create a readable stream that we'll write to
  const stream = new ReadableStream({
    start(controller) {
      console.log('[SSE] Stream starting')
      let isActive = true

      // Send initial message
      const initialMessage = 'data: {"type":"connected"}\n\n'
      controller.enqueue(new TextEncoder().encode(initialMessage))

      // Set up the writer for broadcasts
      const writer = {
        write: async (data: Uint8Array) => {
          if (!isActive) return Promise.reject(new Error('Stream inactive'))
          try {
            controller.enqueue(data)
            return Promise.resolve()
          } catch (error) {
            console.error('[SSE] Error writing to stream:', error)
            return Promise.reject(error)
          }
        },
        close: () => {
          isActive = false
          try {
            controller.close()
            return Promise.resolve()
          } catch (error) {
            return Promise.reject(error)
          }
        },
        get closed() {
          return !isActive
        },
        get ready() {
          return Promise.resolve()
        },
        get desiredSize() {
          return isActive ? 1 : null
        },
        abort: () => {
          isActive = false
          return Promise.resolve()
        },
        releaseLock: () => {},
      }

      // Subscribe to broadcasts
      console.log('[SSE] Subscribing to broadcaster')
      const unsubscribe = broadcaster.subscribe(writer)

      // Keep-alive setup with error tracking
      let failedPings = 0
      const MAX_FAILED_PINGS = 3

      const keepAlive = setInterval(() => {
        if (!isActive) {
          clearInterval(keepAlive)
          return
        }

        try {
          const ping = 'event: ping\ndata: keep-alive\n\n'
          controller.enqueue(new TextEncoder().encode(ping))
          console.log('[SSE] Keep-alive sent')
          failedPings = 0 // Reset counter on successful ping
        } catch (error) {
          console.log('[SSE] Keep-alive failed:', error)
          failedPings++

          if (failedPings >= MAX_FAILED_PINGS) {
            console.log('[SSE] Too many failed pings, cleaning up')
            isActive = false
            clearInterval(keepAlive)
            unsubscribe()
          }
        }
      }, 30000)

      // Cleanup on stream end
      return () => {
        console.log('[SSE] Stream ending, cleaning up')
        isActive = false
        clearInterval(keepAlive)
        unsubscribe()
      }
    },
    cancel() {
      console.log('[SSE] Stream cancelled by client')
    },
  })

  // Return the response with the stream and CORS headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*', // Or your specific domain
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
