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
      options: [], 
      correctAnswer: "",
      selectedOption: null,
      revealAnswer: false,
      timeRemaining: 15,
      timerInterval: null,
      modalShown: false,
      modalType: "", // result / reveal
      modalTitle: "",
      playerScore: 0,
    };
  },
  computed: {
    sortedPlayers() {
      // Get leaderboard sorted by score descending
      return Object.entries(this.players)
        .map(([id, player]) => ({ id, ...player }))
        .sort((a, b) => b.score - a.score);
    },
  },
  methods: {
    joinGame() {
      const name = this.playerName.trim();
      if (name === "") {
        alert("Please enter your name.");
        return;
      }
      // Connect with name
      this.connectWebSocket(name);
    },
    connectWebSocket(name) {
      const wsProtocol = location.protocol === "https:" ? "wss" : "ws"; // Choose secure protocol if https
      this.socket = new WebSocket(`${wsProtocol}://${location.host}`);

      this.socket.addEventListener("open", () => {
        //login with name
        this.socket.send(JSON.stringify({ type: "set-name", name }));
      });

      this.socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        this.handleSocketMessage(data);
      });

      this.socket.addEventListener("close", () => {
        console.warn("WebSocket connection closed.");
        alert("Connection lost. Please refresh the page to reconnect.");
      });

      this.socket.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        alert("An error occurred while listening to the server:", error);
      });

      this.gameState = "game";
    },
    handleSocketMessage(data) {
      switch (data.type) {
        case "welcome":
          this.playerId = data.playerId;
          break;

        case "player-update":
          this.players = data.players;
          // Update this player's score if available
          if (this.playerId && this.players[this.playerId]) {
            this.playerScore = this.players[this.playerId].score;
          }
          break;

        case "new-question":
          this.displayQuestion(data.question);
          break;

        case "reveal-answer":
          this.revealAnswer = true;
          this.correctAnswer = data.correctAnswer;
          this.players = data.players; // Updated player scores
          if (this.playerId && this.players[this.playerId]) {
            this.playerScore = this.players[this.playerId].score;
          }
          this.showRevealModal();
          break;

        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    },
    displayQuestion(question) {
      // Reset state for new question
      this.selectedOption = null;
      this.revealAnswer = false;
      this.correctAnswer = "";

      this.category = question.category;
      this.questionText = question.question;
      this.options = question.options;

      this.timeRemaining = 15;
      clearInterval(this.timerInterval);
      this.startTimer();
    },
    submitAnswer(option) {
      if (this.selectedOption || this.revealAnswer) return; // no multiple answers

      this.selectedOption = option;
      this.socket.send(
        JSON.stringify({ type: "submit-answer", answer: option })
      );
    },
    startTimer() {
      this.timerInterval = setInterval(() => {
        if (this.timeRemaining > 0) {
          this.timeRemaining -= 1;
        } else {
          clearInterval(this.timerInterval);
        }
      }, 1000);
    },
    showRevealModal() {
      this.modalType = "reveal";
      this.modalTitle = `Time's Up!`;
      this.modalShown = true;

      // Automatically hide the modal after 3 seconds
      setTimeout(() => {
        this.modalShown = false;
      }, 3000);
    },
  },
  beforeUnmount() {
    if (this.socket) {
      this.socket.close();
    }
    clearInterval(this.timerInterval);
  },
}).mount("body");