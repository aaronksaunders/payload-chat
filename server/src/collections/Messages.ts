import type { CollectionConfig } from 'payload'
import { broadcaster } from '@/lib/messageBroadcaster'
import { SSEMessages } from '@/endpoints/SSEMessages'

export const Messages: CollectionConfig = {
  slug: 'messages',
  access: {
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
  },
  endpoints: [SSEMessages],
  // hooks: {
  //   afterChange: [
  //     async ({ doc }) => {
  //       try {
  //         console.log('[Messages Hook] Broadcasting new/updated message:', doc)
  //         await broadcaster.broadcast([doc])
  //         console.log('[Messages Hook] Broadcast complete')
  //       } catch (error) {
  //         console.error('[Messages Hook] Broadcasting error:', error)
  //       }
  //     },
  //   ],
  // },
  fields: [
    {
      name: 'sender',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'receiver',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'content',
      type: 'text',
      required: true,
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
    },
  ],
}
