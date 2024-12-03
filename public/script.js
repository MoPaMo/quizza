// public/client.js
const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${wsProtocol}://${location.host}`);

let playerId = null;
let playerName = "";
let timerInterval = null;

// Elements
const joinSection = document.getElementById("join-section");
const nameInput = document.getElementById("name-input");
const joinBtn = document.getElementById("join-btn");

const gameSection = document.getElementById("game-section");
const questionCategory = document.getElementById("question-category");
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const playersList = document.getElementById("players-list");
const timerElement = document.getElementById("time-remaining");

const resultModal = document.getElementById("result-modal");
const resultText = document.getElementById("result-text");
const correctAnswerText = document.getElementById("correct-answer-text");
const closeModal = document.getElementById("close-modal");

// Join the game
joinBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (name === "") {
    alert("Please enter your name.");
    return;
  }
  playerName = name;
  socket.send(JSON.stringify({ type: "join" }));
  socket.send(JSON.stringify({ type: "set-name", name: playerName }));
  joinSection.classList.add("hidden");
  gameSection.classList.remove("hidden");
});

// Handle incoming messages
socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "welcome":
      playerId = data.playerId;
      break;

    case "player-update":
      updateLeaderboard(data.players);
      break;

    case "new-question":
      displayQuestion(data.question);
      break;

    case "reveal-answer":
      showCorrectAnswer(data.correctAnswer);
      break;

    case "answer-result":
      displayAnswerResult(data.correct, data.score);
      break;

    default:
      console.warn("Unknown message type:", data.type);
  }
});


