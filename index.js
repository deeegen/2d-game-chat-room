const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "avatar-" + unique + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/gif"];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(null, false);
};

const upload = multer({ storage, fileFilter });

const players = {}; // { socket.id: { x, y, chat, username, avatar } }

app.use(express.static("public"));
app.use("/uploads", express.static(UPLOAD_DIR));

app.post("/upload-avatar", upload.single("avatar"), (req, res) => {
  const username = req.body.username || "Anonymous";
  const avatar = req.file ? req.file.filename : null;
  res.json({ username, avatar });
});

io.on("connection", (socket) => {
  socket.on("setUsername", ({ username, avatar }) => {
    players[socket.id] = {
      x: 300,
      y: 200,
      chat: "",
      username,
      avatar,
    };
    socket.emit("currentPlayers", players);
    socket.broadcast.emit("newPlayer", {
      id: socket.id,
      pos: players[socket.id],
    });
  });

  socket.on("chat", (msg) => {
    if (players[socket.id]) {
      players[socket.id].chat = msg;
      io.emit("chat", { id: socket.id, msg });
      setTimeout(() => {
        if (players[socket.id]) {
          players[socket.id].chat = "";
          io.emit("chat", { id: socket.id, msg: "" });
        }
      }, 3000);
    }
  });

  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].x += data.x;
      players[socket.id].y += data.y;
      io.emit("move", { id: socket.id, data });
    }
  });

  socket.on("disconnect", () => {
    const avatar = players[socket.id]?.avatar;
    if (avatar) {
      fs.unlink(path.join(UPLOAD_DIR, avatar), (err) => {
        if (err) console.error("Error deleting avatar:", err);
      });
    }
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

setInterval(() => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return;
    files.forEach((file) => {
      const filePath = path.join(UPLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        const age = Date.now() - stats.mtimeMs;
        if (age > 1000 * 60 * 30) {
          fs.unlink(filePath, (err) => {
            if (err) console.error("Cleanup error:", err);
          });
        }
      });
    });
  });
}, 5 * 60 * 1000);

server.listen(3000, () =>
  console.log("Server running at http://localhost:3000")
);
