import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import cors from 'cors';
import {Player} from "../src/types";
import {Deck} from "../src/Card";

//In summary, socket.emit is for sending messages to one client,
// io.emit is for broadcasting to all clients,
// and socket.on is for listening for messages/events.

const app = express();
app.use(cors({origin: "http://localhost:3000", methods: ["GET", "POST"], credentials: true}));

const server = http.createServer(app);
const io = new Server(server, {cors: {origin: "http://localhost:3000", methods: ["GET", "POST"], credentials: true}});

const players: Player[] = [];
const MAX_PLAYERS = 4;
const MAX_CARDS_SLOT = 4;
let currentRoundCards: any[] = [];
let currentTurn = 0;
let currentRound = 1;
let choosingCardAllowed = true; // To control card choosing

io.on('connection', (socket) => {
    let currentPlayerName = '';

    socket.on('joinGame', (playerName: string) => {
        currentPlayerName = playerName;
        const existingPlayer = players.find(p => p.name === playerName);
        if (!existingPlayer) {
            players.push({name: playerName, index: players.length, socketId: socket.id, guess: 0, takes: 0, score: 0});
        }
        io.emit('updatePlayers', players.map(p => p.name));
        if (players.length === MAX_PLAYERS) {
            startGame();
            io.emit('update-turn', currentTurn); // Ensure the first turn is set
        }
        io.emit('playerStats', players);
    });

    socket.on('chooseCard', (playerName: string, chosenCard: any) => {
        if (!choosingCardAllowed) {
            return; // If choosing a card is not allowed, simply return
        }
        const playerIndex = players.findIndex(p => p.name === playerName);
        if (playerIndex === -1 || currentRoundCards.length >= MAX_CARDS_SLOT) {
            return;
        }
        currentRoundCards.push({card: chosenCard, playerIndex});
        // currentTurn = (currentTurn + 1) % players.length;
        io.emit('cardChosen', playerName, chosenCard, currentRoundCards);

        if (currentRoundCards.length === MAX_CARDS_SLOT) {
            const winningPlayerIndex = determineHighestCard(currentRoundCards);
            players[winningPlayerIndex].takes++;
            io.emit('roundEnded', players, winningPlayerIndex);
            choosingCardAllowed = false; // Disable choosing of cards
            setTimeout(() => {
                currentRoundCards = [];
                choosingCardAllowed = true; // Re-enable choosing of cards after a delay
                currentTurn = winningPlayerIndex; // Set the winner of the round as the next to play
                io.emit('update-turn', currentTurn); // Emit the updated turn
                io.emit('clearChosenCards');
            }, 3000);
        }
    });

    socket.on('disconnect', () => {
        const playerIndex = players.findIndex(p => p.name === currentPlayerName);
        if (playerIndex !== -1) {
            players.splice(playerIndex, 1);
            io.emit('updatePlayers', players.map(p => p.name));
        }
    });

    // controls turns of players
    socket.on('turn',()=>{
        // The player with index 0 is starting.
        // after the player put a card on the table the turn move to the next player.
        // at the end of the round the player who won the round will start the next round.
        // I created a currentTurn with present the index of the player who turn to play.
        // complete the task give me the implementation here and also in the Game.tsx and explain the logic
        currentTurn = (currentTurn + 1) % players.length;
        io.emit('update-turn', currentTurn);
    })

});

function determineHighestCard(currentRoundCards: { card: any; playerIndex: number }[]): number {
    let highestCardIndex = -1;
    let highestCardValue = 0;
    const faceToNumber: { [key: string]: number } = {'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2};

    currentRoundCards.forEach(({card, playerIndex}) => {
        const cardValue = faceToNumber[card.value] || parseInt(card.value, 10);
        if (cardValue > highestCardValue) {
            highestCardValue = cardValue;
            highestCardIndex = playerIndex;
        }
    });
    currentTurn = highestCardIndex;
    return highestCardIndex;
}

function startGame() {
    const deck = new Deck();
    deck.shuffle();
    const hands = deck.deal();
    hands.forEach((handOfCards, index) => {
        hands[index] = deck.sortCardsBySuitAndValue(handOfCards);
    });
    players.forEach((player, index) => {
        io.to(player.socketId).emit('gameStarted', player.name, hands[index]);
    });

}

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
