import { Message } from '@/payload-types'

interface StreamWriter {
  write: (data: Uint8Array) => Promise<void>
  close: () => Promise<void>
  closed: boolean
  ready: Promise<void>
  desiredSize: number | null
}

class MessageBroadcaster {
  private subscribers: Set<StreamWriter> = new Set()

  subscribe(writer: StreamWriter) {
    if (!writer) {
      console.error('[Subscribe] Attempted to subscribe with invalid writer')
      return () => {}
    }

    // Check if writer is already subscribed
    if (this.subscribers.has(writer)) {
      console.log('[Subscribe] Writer already subscribed')
      return () => {
        console.log('[Unsubscribe] Removing subscriber')
        this.subscribers.delete(writer)
        console.log('[Unsubscribe] Subscribers remaining:', this.subscribers.size)
      }
    }

    this.subscribers.add(writer)
    console.log('[Subscribe] New subscriber added. Total subscribers:', this.subscribers.size)

    // Verify subscription
    setImmediate(() => {
      if (this.subscribers.has(writer)) {
        console.log('[Subscribe] Subscription verified')
      } else {
        console.warn('[Subscribe] Subscription verification failed')
      }
    })

    return () => {
      console.log('[Unsubscribe] Removing subscriber')
      this.subscribers.delete(writer)
      console.log('[Unsubscribe] Subscribers remaining:', this.subscribers.size)
    }
  }

  async broadcast(messages: Message[]) {
    const timestamp = new Date().toISOString()
    console.log(`[Broadcast ${timestamp}] Starting broadcast`)
    console.log('[Broadcast] Current subscriber count:', this.subscribers.size)

    if (this.subscribers.size === 0) {
      console.log('[Broadcast] No subscribers to broadcast to')
      return
    }

    const messageStr = JSON.stringify(messages)
    console.log('[Broadcast] Broadcasting messages:', messageStr)

    const sseMessage = `data: ${messageStr}\n\n`
    const data = new TextEncoder().encode(sseMessage)

    const deadSubscribers = new Set<StreamWriter>()
    let successCount = 0

    for (const writer of this.subscribers) {
      try {
        await writer.write(data)
        successCount++
        console.log(
          `[Broadcast] Message sent successfully to subscriber (${successCount}/${this.subscribers.size})`,
        )
      } catch (error) {
        console.error('[Broadcast] Error broadcasting message:', error)
        deadSubscribers.add(writer)
      }
    }

    // Clean up dead subscribers
    if (deadSubscribers.size > 0) {
      for (const writer of deadSubscribers) {
        this.subscribers.delete(writer)
      }
      console.log('[Broadcast] Removed dead subscribers. Remaining:', this.subscribers.size)
    }

    console.log(
      `[Broadcast ${timestamp}] Broadcast complete. Success: ${successCount}, Failed: ${deadSubscribers.size}`,
    )
  }
}

export const broadcaster = new MessageBroadcaster()
