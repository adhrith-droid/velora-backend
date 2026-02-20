"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var http_1 = require("http");
var socket_io_1 = require("socket.io");
var path_1 = require("path");
var url_1 = require("url");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
var app = (0, express_1.default)();
var httpServer = (0, http_1.createServer)(app);
var io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
var PORT = 3000;
// Serve static files from the 'public' directory
app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
// Matchmaking state
var waitingUser = null;
var pairs = new Map();
io.on("connection", function (socket) {
    console.log("User connected:", socket.id);
    socket.on("find-partner", function () {
        // If already in a pair, disconnect first
        if (pairs.has(socket.id)) {
            var partnerId = pairs.get(socket.id);
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
            var partnerId = waitingUser;
            waitingUser = null;
            pairs.set(socket.id, partnerId);
            pairs.set(partnerId, socket.id);
            // Tell both users to start the connection
            // We designate one as the initiator
            io.to(socket.id).emit("match-found", { partnerId: partnerId, initiator: true });
            io.to(partnerId).emit("match-found", { partnerId: socket.id, initiator: false });
            console.log("Matched ".concat(socket.id, " with ").concat(partnerId));
        }
        else {
            waitingUser = socket.id;
            socket.emit("waiting");
            console.log("User ".concat(socket.id, " is waiting"));
        }
    });
    socket.on("signal", function (data) {
        var partnerId = pairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit("signal", {
                from: socket.id,
                signal: data.signal
            });
        }
    });
    socket.on("disconnect", function () {
        console.log("User disconnected:", socket.id);
        if (waitingUser === socket.id) {
            waitingUser = null;
        }
        var partnerId = pairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit("partner-disconnected");
            pairs.delete(partnerId);
            pairs.delete(socket.id);
        }
    });
});
httpServer.listen(PORT, "0.0.0.0", function () {
    console.log("Server running on http://0.0.0.0:".concat(PORT));
});
