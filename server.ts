import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Matchmaking state
let waitingUser: string | null = null;
const pairs = new Map<string, string>();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("find-partner", () => {
    // If already in a pair, disconnect first
    if (pairs.has(socket.id)) {
      const partnerId = pairs.get(socket.id);
      if (partnerId) {
        io.to(partnerId).emit("partner-disconnected");
        pairs.delete(partnerId);
      }
      pairs.delete(socket.id);
    }

    // If this user was the one waiting, clear it
    if (waitingUser === socket.id) {
      waitingUser = null;
    }

    if (waitingUser && waitingUser !== socket.id) {
      const partnerId = waitingUser;
      waitingUser = null;

      pairs.set(socket.id, partnerId);
      pairs.set(partnerId, socket.id);

      // Tell both users to start the connection
      // We designate one as the initiator
      io.to(socket.id).emit("match-found", { partnerId, initiator: true });
      io.to(partnerId).emit("match-found", { partnerId: socket.id, initiator: false });
      
      console.log(`Matched ${socket.id} with ${partnerId}`);
    } else {
      waitingUser = socket.id;
      socket.emit("waiting");
      console.log(`User ${socket.id} is waiting`);
    }
  });

  socket.on("signal", (data) => {
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("signal", {
        from: socket.id,
        signal: data.signal
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (waitingUser === socket.id) {
      waitingUser = null;
    }
    const partnerId = pairs.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("partner-disconnected");
      pairs.delete(partnerId);
      pairs.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
