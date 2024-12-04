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
      const wsProtocol = location.protocol === "https:" ? "wss" : "ws"; //chose secure protocol if https
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
        alert("An error occured while listening to the server:", error);
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
          break;

        case "new-question":
          this.displayQuestion(data.question);
          break;

        case "reveal-answer":
          this.revealAnswer = true;
          this.correctAnswer = data.correctAnswer;
          this.playerScore = data.score;
          this.showResultModal(data.correct);
          break;

        case "time-up":
          this.timerEnded = true;
          this.showTimeUpModal();
          break;

        default:
          console.warn("Unknown message type:", data.type);
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
      if (this.selectedOption || this.revealAnswer || this.timerEnded) return; // dont run if already answered/tme up

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
    //utility modals:

    showResultModal(correct) {
      this.modalType = "result";
      this.modalTitle = correct ? "Correct!" : "Wrong!";
      this.modalShown = true;

      setTimeout(() => {
        //hide modal after 5 seconds
        this.modalShown = false;
      }, 5000);
    },
    showTimeUpModal() {
      this.modalType = "timeUp";
      this.modalTitle = "Time's Up!";
      this.modalShown = true;

      setTimeout(() => {
        //hide after 5s
        this.modalShown = false;
      }, 5000);
    },
  },
  beforeUnmount() {
    if (this.socket) {
      this.socket.close();
    }
    clearInterval(this.timerInterval);
  },
}).mount("body");
