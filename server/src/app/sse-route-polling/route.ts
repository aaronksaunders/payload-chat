import configPromise from '@payload-config'
import { getPayload } from 'payload'

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
  const payload = await getPayload({
    config: configPromise,
  })

  const abortController = new AbortController()
  const { signal } = abortController

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const encoder = new TextEncoder()

  // Track last message timestamp
  let lastTimestamp = new Date(0).toISOString()

  try {
    const keepAlive = setInterval(async () => {
      if (!signal.aborted) {
        await writer.write(encoder.encode('event: ping\ndata: keep-alive\n\n'))
      }
    }, 30000)

    const pollMessages = async () => {
      if (!signal.aborted) {
        const messages = await payload.find({
          collection: 'messages',
          where: {
            updatedAt: { greater_than: lastTimestamp },
          },
          sort: '-updatedAt',
          limit: 10,
        })

        if (messages.docs.length > 0) {
          // Update timestamp to latest message
          lastTimestamp = messages.docs[0].updatedAt
          await writer.write(
            encoder.encode(`event: message\ndata: ${JSON.stringify(messages.docs)}\n\n`),
          )
        }
      }
    }

    const messageInterval = setInterval(pollMessages, 1000)

    signal.addEventListener('abort', () => {
      clearInterval(keepAlive)
      clearInterval(messageInterval)
      writer.close()
    })

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*', // Or your specific domain
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Error occurred:', error)
    return new Response('Error occurred', { status: 500 })
  }
}
