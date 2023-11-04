import express from 'express';
import http from 'http';
import {Server} from 'socket.io';
import cors from 'cors';
import {Card, Deck} from "../src/Card";
import {Player} from "../src/types";
const app = express();

app.use(cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
    },
});


const players: Player[] = [];
const MAX_PLAYERS = 4;
const MAX_CARDS_SLOT = 4;
let chosenCards: { player: string; card: Card; }[] = [];
let currentRoundCards: Card[] = [];
let currentRound = 1;

io.on('connection', (socket) => {
    console.log('A user connected');
    let currentPlayerName = '';

    socket.on('joinGame', (playerName: string) => {
        currentPlayerName = playerName;
        console.log(`${playerName} joined the game`);
        const existingPlayer = players.find(p => p.name === playerName);
        if (!existingPlayer) {
            players.push({name: playerName, socketId: socket.id, guess: 0, takes: 0, score: 0});
        }
        io.emit('updatePlayers', players.map(p => p.name));
        if (players.length === MAX_PLAYERS) {
            startGame();
        }

        io.emit('playerStats',players.map(p=>({
            name: p.name,
            guess: p.guess,
            takes: p.takes,
            score: p.score
        })));
    });

    socket.on('chooseCard', (playerName: string, chosenCard: Card) => {
        console.log(`${playerName} chose a card:`, chosenCard);

        // Add card to the current round cards and notify clients
        if (currentRoundCards.length < MAX_CARDS_SLOT) {
            // Add card to the current round cards and notify clients
            currentRoundCards.push(chosenCard);
            io.emit('cardChosen', playerName, chosenCard, currentRoundCards);
        }
        // Check if the round has ended
        if (currentRoundCards.length === MAX_CARDS_SLOT) {
            const winningPlayerIndex = determineHighestCard(currentRoundCards, null, null);
            console.log(`player ${winningPlayerIndex} has won`);
            // players[winningPlayerIndex].takes++;

            // Reset for next round
            currentRoundCards.length = 0;
            // currentPlayer = winningPlayerIndex;

            // Notify clients about the round end and winner
            io.emit('roundEnded', players.map(p => ({name: p.name, takes: p.takes})), winningPlayerIndex);
        }
    });

    function determineHighestCard(gameAreaCards: (Card | null)[], roundSuit: string | null, sliceSuit: string | null): number {
        let maxRoundSuitCardValue = 0;
        let maxSliceSuitCardValue = 0;
        let winningPlayerIndexSliceSuit = -1;
        let winningPlayerIndexRoundSuit = -1;

        const faceToNumber: { [key: string]: number } = {'A': 14, 'K': 13, 'Q': 12, 'J': 11};

        gameAreaCards.forEach((card, index) => {
            if (card) {
                const cardValue = faceToNumber[card.value] || parseInt(card.value, 10);

                if (card.suit === sliceSuit) {
                    if (cardValue > maxSliceSuitCardValue) {
                        maxSliceSuitCardValue = cardValue;
                        winningPlayerIndexSliceSuit = index;
                    }
                } else if (card.suit === roundSuit) {
                    if (cardValue > maxRoundSuitCardValue) {
                        maxRoundSuitCardValue = cardValue;
                        winningPlayerIndexRoundSuit = index;
                    }
                }
            }
        });

        // If there's a slice suit card, it wins regardless of round suit cards
        if (maxSliceSuitCardValue > 0) return winningPlayerIndexSliceSuit;

        return winningPlayerIndexRoundSuit;
    }


    socket.on('disconnect', () => {
        console.log(`${currentPlayerName} disconnected`);
        const playerIndex = players.findIndex(p => p.name === currentPlayerName);
        if (playerIndex !== -1) {
            players.splice(playerIndex, 1);
            io.emit('updatePlayers', players.map(p => p.name));
        }
    });
});

function startGame() {
    console.log('Game started with players:', players.map(p => p.name));
    const deck = new Deck();
    deck.shuffle();
    const hands = deck.deal();
    hands.forEach((handOfCards: Card[], index: number): void => {
        hands[index] = deck.sortCardsBySuitAndValue(handOfCards);
    })

    players.forEach((player, index) => {
        io.to(player.socketId).emit('gameStarted', player.name, hands[index]);
    });
}

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

