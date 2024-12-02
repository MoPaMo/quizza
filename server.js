const express = require("express");
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid"); // For generating unique player IDs

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Load questions
let questions = {};
try {
  questions = JSON.parse(fs.readFileSync("questions.json", "utf8"));
} catch (err) {
  console.error("Error reading questions file:", err);
}

// Game state
let players = {}; // { playerId: { name, score, ws } }
let currentQuestion = null;
let currentCategory = null;
let currentQuestionIndex = 0;
let acceptingAnswers = false;

// Broadcast message to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Function to select the next question
function selectNextQuestion() {
  if (!currentCategory || !questions[currentCategory]) {
    const categories = Object.keys(questions);
    currentCategory = categories[Math.floor(Math.random() * categories.length)];
    currentQuestionIndex = 0;
  }

  if (currentQuestionIndex >= questions[currentCategory].length) {
    // All questions in the current category have been used
    currentCategory = null;
    currentQuestionIndex = 0;
    selectNextQuestion(); // Recursive call to select a new category
    return;
  }

  currentQuestion = questions[currentCategory][currentQuestionIndex];
  currentQuestionIndex++;

  // Broadcast the new question to all players
  broadcast({
    type: "new-question",
    question: {
      category: currentCategory,
      question: currentQuestion.question,
      options: currentQuestion.options,
      index: currentQuestionIndex,
    },
  });

  acceptingAnswers = true;

  // Set timer for accepting answers
  setTimeout(() => {
    acceptingAnswers = false;
    // Reveal the correct answer
    broadcast({
      type: "reveal-answer",
      correctAnswer: currentQuestion.answer,
    });
    // Move to the next question after a short delay
    setTimeout(selectNextQuestion, 5000);
  }, 15000); // 15 seconds per question
}

// Handle new WebSocket connections
wss.on("connection", (ws) => {
  const playerId = uuidv4();
  players[playerId] = { name: "Anonymous", score: 0, ws };

  // Send a welcome message with the assigned player ID
  ws.send(JSON.stringify({ type: "welcome", playerId }));

  // Send current game state
  if (currentQuestion) {
    ws.send(
      JSON.stringify({
        type: "new-question",
        question: {
          category: currentCategory,
          question: currentQuestion.question,
          options: currentQuestion.options,
          index: currentQuestionIndex,
        },
      })
    );
  }

  // Notify all clients about the updated player list
  broadcast({ type: "player-update", players: getPublicPlayers() });

  // Handle incoming messages from clients
  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error("Invalid JSON:", err);
      return;
    }

    if (data.type === "set-name") {
      // Update player name
      players[playerId].name = data.name || "Anonymous";
      broadcast({ type: "player-update", players: getPublicPlayers() });
    } else if (data.type === "submit-answer" && acceptingAnswers) {
      const player = players[playerId];
      if (!player.answered) {
        player.answered = true;
        if (data.answer === currentQuestion.answer) {
          player.score += 10;
          ws.send({ type: "answer-result", correct: true, score: player.score });
        } else {
          ws.send({ type: "answer-result", correct: false });
        }
        broadcast({ type: "player-update", players: getPublicPlayers() });
      }
    }
  });

  // Handle disconnections
  ws.on("close", () => {
    delete players[playerId];
    broadcast({ type: "player-update", players: getPublicPlayers() });
  });
});

// Helper function to get public player info (excluding WebSocket)
function getPublicPlayers() {
  const publicPlayers = {};
  for (const [id, player] of Object.entries(players)) {
    publicPlayers[id] = { name: player.name, score: player.score };
  }
  return publicPlayers;
}

// Start the game loop
function startGame() {
  selectNextQuestion();
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Quiz game running on http://localhost:${PORT}`)
);

// Initialize the game after server starts
wss.on("listening", () => {
  startGame();
});