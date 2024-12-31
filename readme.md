# Payload Chat

Payload on the backend with a custom endpoint using [(Server-Sent Events) SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) to send updates to the client, The client listens for updates using the EventSource API.

This was just an exercise to see what interesting things can be done when using Payload as a platform for building applications, not just as a CMS

## Project Structure

- `client/` - React frontend built with Vite
- `server/` - Payload backend Server

## Main Components of Solution

### Server

Messages Collection

```javascript
export const Messages: CollectionConfig = {
  slug: "messages",
  // not focused on access in this example
  access: {
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
  },
  endpoints: [SSEMessages], // <-- ADDED CUSTOM ENDPOINT api/messages/sse
  fields: [
    {
      name: "sender",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "receiver",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "content",
      type: "text",
      required: true,
    },
    {
      name: "timestamp",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
    },
  ],
};
```

Custom Endpoint for SSE Added to Collection

```javascript
import type { Endpoint } from "payload";

/**
 * Server-Sent Events (SSE) endpoint for Messages collection using TransformStream
 * Implements a polling mechanism to check for new messages and stream them to clients
 */
export const SSEMessages: Endpoint = {
  path: "/sse",
  method: "get",
  handler: async (req) => {
    try {
      // Create abort controller to handle connection termination
      const abortController = new AbortController();
      const { signal } = abortController;

      // Set up streaming infrastructure
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();

      // Initialize timestamp to fetch all messages from the beginning
      let lastTimestamp = new Date(0).toISOString();

      // Send keep-alive messages every 30 seconds to maintain connection
      const keepAlive = setInterval(async () => {
        if (!signal.aborted) {
          await writer.write(
            encoder.encode("event: ping\ndata: keep-alive\n\n")
          );
        }
      }, 30000);

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
            collection: "messages",
            where: {
              updatedAt: { greater_than: lastTimestamp },
            },
            sort: "-updatedAt",
            limit: 10,
            depth: 1,
            populate: {
              users: {
                email: true,
              },
            },
          });

          if (messages.docs.length > 0) {
            // Update timestamp to latest message for next poll
            lastTimestamp = messages.docs[0].updatedAt;
            // Send messages to client in SSE format
            await writer.write(
              encoder.encode(
                `event: message\ndata: ${JSON.stringify(messages.docs)}\n\n`
              )
            );
          }
        }
      };

      // Poll for new messages every second
      const messageInterval = setInterval(pollMessages, 1000);

      // Clean up intervals and close writer when connection is aborted
      signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        clearInterval(messageInterval);
        writer.close();
      });

      // Return SSE response with appropriate headers
      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no", // Prevents nginx from buffering the response
          "Access-Control-Allow-Origin": "*", // CORS header for cross-origin requests
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    } catch (error) {
      console.log(error);
      return new Response("Error occurred", { status: 500 });
    }
  },
};
```

### Client

How we connect to the server for the SSE

```javascript
useEffect(() => {
  // Create EventSource connection
  const eventSource = new EventSource(
    `${import.meta.env.VITE_API_URL}${endpoint}`
  );

  // Handle incoming messages
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setMessages((prev) => [...prev, data]);
  };

  // Handle connection open
  eventSource.onopen = () => {
    console.log("SSE Connection Established");
  };

  // Handle errors
  eventSource.onerror = (error) => {
    console.error("SSE Error:", error);
    eventSource.close();
  };

  // Cleanup on component unmount
  return () => {
    eventSource.close();
  };
}, [endpoint]);
```
