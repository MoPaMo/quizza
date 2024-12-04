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
      modalType: "", // result /reveal /timeUp
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
  methods: {
    joinGame() {
      const name = this.playerName.trim();
      if (name === "") {
        alert("Please enter your name.");
        return;
      }
      //connect with name
      this.connectWebSocket(name);
    },
    connectWebSocket(name) {
      const wsProtocol = location.protocol === "https:" ? "wss" : "ws"; //choose secure protocol if https
      this.socket = new WebSocket(`${wsProtocol}://${location.host}`);

      this.socket.addEventListener("open", () => {
        //login with name
        this.socket.send(JSON.stringify({ type: "join" }));
        this.socket.send(JSON.stringify({ type: "set-name", name }));
      });

      this.socket.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        this.handleSocketMessage(data);
      });

      this.socket.addEventListener("close", () => {
        console.warn("WebSocket connection closed.");
        // todo: reconnection  if network failure
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
          this.showResultModal(null); // No specific result, answer is revealed
          break;

        case "time-up":
          this.timerEnded = true;
          this.showTimeUpModal();
          break;

        case "answer-result":
          this.handleAnswerResult(data);
          break;

        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    },
    handleAnswerResult(data) {
      if (data.correct) {
        this.playerScore = data.score;
        this.showResultModal(true);
      } else {
        this.showResultModal(false);
      }
    },
    displayQuestion(question) {
      this.currentQuestionData = question;
      this.selectedOption = null;
      this.revealAnswer = false;
      this.timerEnded = false;

      this.category = question.category;
      this.questionText = question.question;
      this.questions = question.options;
      this.correctAnswer = question.answer;

      this.startTimer(15);
    },
    submitAnswer(option) {
      if (this.selectedOption || this.revealAnswer || this.timerEnded) return; // don't run if already answered/time up

      this.selectedOption = option;
      this.socket.send(
        JSON.stringify({ type: "submit-answer", answer: option })
      );
    },
    startTimer(duration) {
      this.timeRemaining = duration;
      clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.timeRemaining > 0) {
          this.timeRemaining -= 1;
        } else {
          // time up
          clearInterval(this.timerInterval);
          this.timerEnded = true;
          this.socket.send(JSON.stringify({ type: "time-up" }));
          this.showTimeUpModal();
        }
      }, 1000);
    },
    // Utility modals:

    showResultModal(isCorrect) {
      if (isCorrect === null) {
        // This case is for when the answer is revealed without a specific result
        this.modalType = "reveal";
        this.modalTitle = "Answer Revealed!";
      } else if (isCorrect) {
        this.modalType = "result";
        this.modalTitle = "Correct!";
      } else {
        this.modalType = "result";
        this.modalTitle = "Wrong!";
      }

      this.modalShown = true;

      setTimeout(() => {
        // Hide modal after 3 seconds
        this.modalShown = false;
      }, 3000);
    },
    showTimeUpModal() {
      this.modalType = "timeUp";
      this.modalTitle = "Time's Up!";
      this.modalShown = true;

      setTimeout(() => {
        // Hide after 3s
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