import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {Card, Deck} from "../src/Card";


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

interface Player {
    name: string;
    socketId: string;
}

const players: Player[] = [];
const MAX_PLAYERS = 4;

io.on('connection', (socket) => {
    console.log('A user connected');
    let currentPlayerName = '';

    socket.on('joinGame', (playerName: string) => {
        currentPlayerName = playerName;
        console.log(`${playerName} joined the game`);
        const existingPlayer = players.find(p => p.name === playerName);
        if (!existingPlayer) {
            players.push({ name: playerName, socketId: socket.id });
        }
        io.emit('updatePlayers', players.map(p => p.name));
        if (players.length === MAX_PLAYERS) {
            startGame();
        }
    });

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

    hands.forEach((handOfCards:Card[],index:number): void => {
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
