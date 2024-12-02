const express = require("express");
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static("public"));

// Load questions
let questions = {};
try {
  questions = JSON.parse(fs.readFileSync("questions.json", "utf8"));
} catch (err) {
  console.error("Error reading questions file:", err);
}

let players = {}; // { socketId: { name, score } }
let currentQuestionIndex = 0;
let currentCategory = Object.keys(questions)[0];
let currentQuestion = questions[currentCategory][currentQuestionIndex];

// Broadcast message to all players
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Handle WebSocket connections
wss.on("connection", (ws) => {
  let playerId = null;

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "join") {
      // Player joins the game
      playerId = data.playerId;
      players[playerId] = { name: data.name, score: 0 };
      ws.send(
        JSON.stringify({ type: "welcome", players, question: currentQuestion })
      );
      broadcast({ type: "player-update", players });
    } else if (data.type === "answer") {
      // Player submits an answer
      if (currentQuestion && data.answer === currentQuestion.answer) {
        players[playerId].score += 10;
        ws.send(
          JSON.stringify({ type: "correct", score: players[playerId].score })
        );
      } else {
        ws.send(JSON.stringify({ type: "incorrect" }));
      }
      broadcast({ type: "player-update", players });
    }
  });

  ws.on("close", () => {
    if (playerId) {
      delete players[playerId];
      broadcast({ type: "player-update", players });
    }
  });
});

// Move to the next question
function nextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= questions[currentCategory].length) {
    // Change category or end game
    currentQuestionIndex = 0;
    const categoryKeys = Object.keys(questions);
    const nextCategoryIndex =
      (categoryKeys.indexOf(currentCategory) + 1) % categoryKeys.length;
    currentCategory = categoryKeys[nextCategoryIndex];
  }
  currentQuestion = questions[currentCategory][currentQuestionIndex];
  broadcast({ type: "new-question", question: currentQuestion });
}

// Serve next question every 15 seconds
setInterval(nextQuestion, 15000);

const PORT = 3000;
server.listen(PORT, () =>
  console.log(`Quiz game running on http://localhost:${PORT}`)
);
