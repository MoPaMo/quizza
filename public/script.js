// public/script.js
import { createApp } from "vue";

createApp({
  data() {
    return {
      playerName: "",
      gameState: "join", // (join/ game)
      playerId: null,
      players: {},
      category: "Loading...",
      questionText: "Loading...",
      questions: [],
      correctAnswer: "",
      selectedOption: null,
      revealAnswer: false,
      timeRemaining: 15,
      timerInterval: null,
      timerEnded: false,
      modalShown: false,
      modalType: "", // result /timeUp
      modalTitle: "",
      playerScore: 0,
    };
  },
  computed: {
    sortedPlayers() {
      // to get leaderboard sorted by score
      return Object.values(this.players).sort((a, b) => b.score - a.score);
    },
  },
  methods: {},
}).mount("body");

const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${wsProtocol}://${location.host}`);

let playerId = null;
let playerName = "";
let timerInterval = null;

// Current question data
let currentQuestionData = null;
let selectedOption = null;

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

// Allow pressing "Enter" to join the game
nameInput.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    joinBtn.click();
  }
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

// Update the leaderboard
function updateLeaderboard(players) {
  // Convert players object to an array and sort by score descending
  const sortedPlayers = Object.values(players).sort(
    (a, b) => b.score - a.score
  );

  // Clear the current list
  playersList.innerHTML = "";

  // Populate the leaderboard
  sortedPlayers.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = `${player.name}: ${player.score}`;
    playersList.appendChild(li);
  });
}

// Display the new question
function displayQuestion(question) {
  currentQuestionData = question;
  selectedOption = null;

  // Update category and question text
  questionCategory.textContent = `Category: ${question.category}`;
  questionText.textContent = question.question;

  // Clear previous options
  optionsContainer.innerHTML = "";

  // Create buttons for each option
  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.classList.add("option-btn");
    button.textContent = option;
    button.dataset.option = option;
    button.addEventListener("click", () => handleOptionClick(button, option));
    optionsContainer.appendChild(button);
  });

  // Reset and start the timer
  resetTimer(15);

  if (!resultModal.classList.contains("hidden")) {
    resultModal.classList.add("hidden");
  }
}

// Handle option button click
function handleOptionClick(button, answer) {
  if (selectedOption) return; // Prevent multiple selections

  selectedOption = answer;
  button.classList.add("selected");

  // Disable all option buttons
  const allOptionButtons = document.querySelectorAll(".option-btn");
  allOptionButtons.forEach((btn) => {
    btn.disabled = true;
    if (btn !== button) {
      btn.classList.add("disabled");
    }
  });

  // Send the selected answer to the server
  socket.send(JSON.stringify({ type: "submit-answer", answer }));
}

// Show the correct answer by highlighting it
function showCorrectAnswer(correctAnswer) {
  const allOptionButtons = document.querySelectorAll(".option-btn");
  allOptionButtons.forEach((btn) => {
    if (btn.dataset.option === correctAnswer) {
      btn.classList.add("correct");
    }
    // Remove any selection indicators
    btn.classList.remove("selected", "disabled");
    btn.disabled = true;
  });

  // Stop the timer
  clearInterval(timerInterval);
  timerElement.textContent = "0";

  setTimeout(() => {
    resetUI();
  }, 5000);
}

// Display the result to the player using the modal
function displayAnswerResult(correct, score) {
  if (correct) {
    resultText.textContent = "Correct!";
    resultText.style.color = "#28a745"; // Green
  } else {
    resultText.textContent = "Wrong!";
    resultText.style.color = "#dc3545"; // Red
  }

  correctAnswerText.textContent = `The correct answer was: ${currentQuestionData.answer}`;

  // Show the modal
  resultModal.classList.remove("hidden");
}

// Reset UI for the next question
function resetUI() {
  // Clear question and options
  questionText.textContent = "Waiting for the next question...";
  optionsContainer.innerHTML = "";

  // Hide the modal if it's visible
  if (!resultModal.classList.contains("hidden")) {
    resultModal.classList.add("hidden");
  }
}

// Reset the timer
function resetTimer(duration) {
  clearInterval(timerInterval);
  timerElement.textContent = duration;

  timerInterval = setInterval(() => {
    let timeLeft = parseInt(timerElement.textContent, 10);
    if (timeLeft > 0) {
      timeLeft -= 1;
      timerElement.textContent = timeLeft;
    } else {
      clearInterval(timerInterval);
      // Optionally, disable option buttons if time runs out and no answer was selected
      if (!selectedOption) {
        const allOptionButtons = document.querySelectorAll(".option-btn");
        allOptionButtons.forEach((btn) => {
          btn.disabled = true;
          btn.classList.add("disabled");
        });
      }
    }
  }, 1000);
}

// Close the result modal when the close button is clicked
closeModal.addEventListener("click", () => {
  resultModal.classList.add("hidden");
});

window.addEventListener("click", (event) => {
  if (event.target === resultModal) {
    resultModal.classList.add("hidden");
  }
});
