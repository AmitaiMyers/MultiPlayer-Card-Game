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
let currentRoundCards: any[] = [];
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

        io.emit('playerStats', players.map(p => ({
            name: p.name,
            guess: p.guess,
            takes: p.takes,
            score: p.score
        })));
    });

    socket.on('chooseCard', (playerName: string, chosenCard: Card) => {
        const playerIndex = players.findIndex(p => p.name === playerName);
        if (playerIndex === -1) {
            console.error(`Player ${playerName} not found`);
            return;
        }
        console.log(`${playerName} chose a card:`, chosenCard);
        const chosenCardWithPlayer = { card: chosenCard, playerIndex }; // Include the player index here
        // Add card to the current round cards and notify clients
        if (currentRoundCards.length < MAX_CARDS_SLOT) {
            // Add card to the current round cards and notify clients
            currentRoundCards.push(chosenCardWithPlayer);
            io.emit('cardChosen', playerName, chosenCard, currentRoundCards);
        }
        // Check if the round has ended
        if (currentRoundCards.length === MAX_CARDS_SLOT) {
            const winningPlayerIndex = determineHighestCard(currentRoundCards);
            console.log(`player ${players[winningPlayerIndex].name} has won`);
            players[winningPlayerIndex].takes++;

            // Notify clients about the round end and winner
            io.emit('roundEnded', players.map(p => ({name: p.name, takes: p.takes})), winningPlayerIndex);
            currentRoundCards = [];
            io.emit('clearChosenCards');
        }
    });

    // function determineHighestCard(gameAreaCards: (Card | null)[], roundSuit: string | null, sliceSuit: string | null): number {
    //     let maxRoundSuitCardValue = 0;
    //     let maxSliceSuitCardValue = 0;
    //     let winningPlayerIndexSliceSuit = -1;
    //     let winningPlayerIndexRoundSuit = -1;
    //
    //     const faceToNumber: { [key: string]: number } = {'A': 14, 'K': 13, 'Q': 12, 'J': 11};
    //
    //     gameAreaCards.forEach((card, index) => {
    //         if (card) {
    //             const cardValue = faceToNumber[card.value] || parseInt(card.value, 10);
    //
    //             if (card.suit === sliceSuit) {
    //                 if (cardValue > maxSliceSuitCardValue) {
    //                     maxSliceSuitCardValue = cardValue;
    //                     winningPlayerIndexSliceSuit = index;
    //                 }
    //             } else if (card.suit === roundSuit) {
    //                 if (cardValue > maxRoundSuitCardValue) {
    //                     maxRoundSuitCardValue = cardValue;
    //                     winningPlayerIndexRoundSuit = index;
    //                 }
    //             }
    //         }
    //     });
    //
    //     // If there's a slice suit card, it wins regardless of round suit cards
    //     if (maxSliceSuitCardValue > 0) return winningPlayerIndexSliceSuit;
    //
    //     return winningPlayerIndexRoundSuit;
    // }
// This function should be adjusted according to how you store player index/name in the card object
    function determineHighestCard(currentRoundCards: { card: Card; playerIndex: number }[]): number {
        let highestCardIndex = -1;
        let highestCardValue = 0;

        const faceToNumber: { [key: string]: number } = {'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2};

        currentRoundCards.forEach(({ card, playerIndex }) => {
            const cardValue = faceToNumber[card.value] || parseInt(card.value, 10); // Ensure card.value is converted to the corresponding number
            if (cardValue > highestCardValue) {
                highestCardValue = cardValue;
                highestCardIndex = playerIndex; // Assuming this is the index of the player in the players array
            }
        });

        return highestCardIndex; // Index of the player who played the highest card
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

