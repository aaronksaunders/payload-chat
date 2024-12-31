import "./App.css";
import { useEffect, useState } from "react";

function App() {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");

  const sendMessage = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: message,
          sender: 1,
          receiver: 1,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  useEffect(() => {
    const eventSource = new EventSource(
      "http://localhost:3000/api/messages/sse"
    );

    eventSource.addEventListener("message", (event) => {
      const newMessages = JSON.parse(event.data);
      if (newMessages.type) {
        return;
      }

      setMessages((prevMessages) => {
        const existingIds = new Set(prevMessages.map((m) => m.id));
        const uniqueNewMessages = newMessages.filter(
          (m) => !existingIds.has(m.id)
        );
        return [...uniqueNewMessages, ...prevMessages];
      });
    });

    eventSource.addEventListener("ping", (event) => {
      console.log("Keep-alive received:", event.data);
    });

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      setError("Connection lost. Retrying...");
      eventSource.close();
    };

    return () => {
      console.log("Closing SSE connection");
      eventSource.close();
    };
  }, []);

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <>
      <div className="chat-area">
        <div className="chat-title">Enter Message</div>
        <input
          style={{ fontSize: 16, padding: 5 }}
          type="text"
          placeholder="Message"
          onChange={(e) => {
            console.log(e.target.value);
            setMessage(e.target.value);
          }}
        />
        <button onClick={sendMessage} style={{ fontSize: 16, padding: 5 }}>
          Send
        </button>
      </div>
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className="message">
            <div>{message.content}</div>
            <small>
              From: {message.sender?.email} To: {message.receiver?.email}
              <div>{new Date(message.timestamp).toLocaleString()}</div>
            </small>
          </div>
        ))}
      </div>
    </>
  );
}

export default App;
