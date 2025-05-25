import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";

const app = express();

// Middleware
app.use(cors()); // You can configure specific origins for production

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Replace with specific origins in production
    methods: ["GET", "POST"],
  },
});

// Store connected clients
let clients: {
  id: string;
  l1: number;
  l2: number;
  username: string;
  profileUrl: string;
}[] = [];

// Helper to broadcast all users to clients
const broadcastAllUsers = () => {
  io.emit("allUsers", clients);
};

// Handle socket events
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send initial cookie
  socket.emit("setCookie", {
    name: "userSession",
    value: "server-01",
    options: {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  });

  // Register or update a user
  socket.on("register", ({ l1, l2, username, profileUrl }) => {
    const clientData = { id: socket.id, l1, l2, username, profileUrl };
    const index = clients.findIndex(client => client.id === socket.id);

    if (index !== -1) {
      clients[index] = clientData;
      console.log(`Updated client: ${username} at (${l1}, ${l2})`);
    } else {
      clients.push(clientData);
      console.log(`New client registered: ${username} at (${l1}, ${l2})`);
    }

    broadcastAllUsers();
  });

  // Location response update
  socket.on("loc-res", ({ l1, l2 }) => {
    const client = clients.find(c => c.id === socket.id);
    if (client) {
      client.l1 = l1;
      client.l2 = l2;
      broadcastAllUsers();
    }
  });

  // Chat message handling
  socket.on("chatMessage", (message: string) => {
    const sender = clients.find(c => c.id === socket.id);
    if (!sender) {
      console.log("Unregistered user sent a message");
      return;
    }

    const chatData = {
      username: sender.username,
      message,
      profileUrl: sender.profileUrl,
      timestamp: new Date(),
    };

    socket.broadcast.emit("newChatMessage", chatData);
    console.log(`Message from ${sender.username}: ${message}`);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    clients = clients.filter(c => c.id !== socket.id);
    broadcastAllUsers();
  });
});

export { app, server };
