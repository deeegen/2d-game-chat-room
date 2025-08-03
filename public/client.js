const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const players = {};
const avatars = {}; // preload avatar images
let joined = false;

const usernamePrompt = document.getElementById("usernamePrompt");
const usernameInput = document.getElementById("usernameInput");
const avatarInput = document.getElementById("avatarInput");
const usernameSubmit = document.getElementById("usernameSubmit");
const chatInput = document.getElementById("chatInput");

usernameSubmit.addEventListener("click", async () => {
  const username = usernameInput.value.trim() || "Anonymous";
  const avatarFile = avatarInput.files[0];

  let avatar = null;
  if (avatarFile) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("avatar", avatarFile);

    const res = await fetch("/upload-avatar", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    avatar = data.avatar;
  }

  socket.emit("setUsername", { username, avatar });

  usernamePrompt.style.display = "none";
  canvas.style.display = "block";
  chatInput.style.display = "block";
  chatInput.focus();
  joined = true;
});

chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const msg = chatInput.value.trim();
    if (msg) {
      socket.emit("chat", msg);
      chatInput.value = "";
    }
  }
});

socket.on("currentPlayers", (data) => {
  for (const id in data) {
    players[id] = data[id];
    if (players[id].avatar && !avatars[id]) {
      const img = new Image();
      img.src = "/uploads/" + players[id].avatar;
      avatars[id] = img;
    }
  }
});

socket.on("newPlayer", ({ id, pos }) => {
  players[id] = pos;
  if (pos.avatar) {
    const img = new Image();
    img.src = "/uploads/" + pos.avatar;
    avatars[id] = img;
  }
});

socket.on("playerDisconnected", (id) => {
  delete players[id];
  delete avatars[id];
});

socket.on("chat", ({ id, msg }) => {
  if (players[id]) players[id].chat = msg;
});

document.addEventListener("keydown", (e) => {
  if (!joined) return;
  const movement = { x: 0, y: 0 };
  if (e.key === "ArrowUp") movement.y = -5;
  if (e.key === "ArrowDown") movement.y = 5;
  if (e.key === "ArrowLeft") movement.x = -5;
  if (e.key === "ArrowRight") movement.x = 5;
  if (movement.x || movement.y) socket.emit("move", movement);
});

socket.on("move", ({ id, data }) => {
  if (!players[id])
    players[id] = { x: 300, y: 200, chat: "", username: "Anonymous" };
  players[id].x += data.x;
  players[id].y += data.y;
});

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const id in players) {
    const p = players[id];
    if (avatars[id]) {
      ctx.drawImage(avatars[id], p.x, p.y, 64, 64);
    } else {
      ctx.fillStyle = id === socket.id ? "blue" : "red";
      ctx.fillRect(p.x, p.y, 20, 20);
    }
    if (p.username) {
      ctx.fillStyle = "black";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.username, p.x + 32, p.y - 10);
    }
    if (p.chat) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      const padding = 4;
      const textWidth = ctx.measureText(p.chat).width;
      const bubbleWidth = textWidth + padding * 2;
      const bubbleHeight = 20;
      const bx = p.x + 32 - bubbleWidth / 2;
      const by = p.y - bubbleHeight - 25;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(bx, by, bubbleWidth, bubbleHeight);
      ctx.strokeStyle = "#000000";
      ctx.strokeRect(bx, by, bubbleWidth, bubbleHeight);
      ctx.fillStyle = "#000000";
      ctx.fillText(p.chat, p.x + 32, by + 15);
    }
  }
  requestAnimationFrame(draw);
}
draw();
