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

let players: Player[] = [];
const MAX_PLAYERS = 4;
const MAX_CARDS_SLOT = 4;
let currentRoundCards: any[] = [];
let currentTurn = 0;
let currentRound = 0;
let choosingCardAllowed = true; // To control card choosing
type Suit = '♣' | '♦' | '♥' | '♠';
const suitStrength: Record<Suit, number> = {'♣': 1, '♦': 2, '♥': 3, '♠': 4};

// Assuming bid object is of type:
interface Bid {
    number: number;
    suit: Suit;
}

// Slice suit phase
let currentPlayerTurnBet: number = 0;
let isBiddingPhase: boolean = true;
let passedPlayer: boolean[] = [false, false, false, false];
let highestBidder: number | null = null;
let currentBetNumber: number = 0;
let currentBetSuit: Suit = '♣';
let sliceSuit: Suit | null = null;

// Declare
let currentDeclareTurn: number = 0;
let isDeclarePhase = false;
let sumOfDeclares = 0;
let declaredPlayers: boolean[] = [false, false, false, false];

io.on('connection', (socket) => {
    let currentPlayerName = '';

    socket.on('joinGame', (playerName: string) => {
        currentPlayerName = playerName;
        const existingPlayer = players.find(p => p.name === playerName);
        if (!existingPlayer) {
            players.push({
                name: playerName,
                index: players.length,
                socketId: socket.id,
                declare: 0,
                takes: 0,
                score: 0,
                cardsHand: 13
            });
        }
        // io.emit('updatePlayers', players.map(p => p.name));
        io.emit('updatePlayers', players);
        if (players.length === MAX_PLAYERS) {
            startGame();
            io.emit('update-turn', currentTurn); // Ensure the first turn is set
        }
        io.emit('playerStats', players);
        // Reset declaredPlayers when a new game starts
        declaredPlayers = declaredPlayers.map(() => false);

    });

    // Slice suit phase
    socket.on('sliceSuitBid', (playerIndex, bid: Bid) => {
        if (isBiddingPhase) {
            if (bid !== null) {
                // Player submitted a bid
                const isNewBidHigher = bid.number > currentBetNumber ||
                    (bid.number === currentBetNumber && suitStrength[bid.suit] > suitStrength[currentBetSuit]);

                if (isNewBidHigher) {
                    currentBetNumber = bid.number;
                    currentBetSuit = bid.suit; // Store the suit of the bid
                    highestBidder = playerIndex;
                } else {
                    // Player passed
                    passedPlayer[playerIndex] = true;
                }
            } else {
                // Player passed
                passedPlayer[playerIndex] = true;
            }

            // Check if three players have passed
            const passedCount = passedPlayer.filter(passed => passed).length;
            if (passedCount === players.length && highestBidder == null) {
                startGame();
            } else {

                if (passedCount >= 3) {
                    if (highestBidder == null) {
                        isBiddingPhase = true;
                    } else {
                        // If the current player has already passed or a bet has been made
                        isBiddingPhase = false;
                        sliceSuit = currentBetSuit; // Set by the highest bidder or default if no bets
                        players[playerIndex].declare = currentBetNumber;
                        io.emit('playerStats', players);
                        startDeclarePhase(); // new
                    }
                    io.emit('sliceSuitUpdate', {
                        currentBetNumber,
                        highestBidder,
                        currentPlayerTurnBet,
                        isBiddingPhase,
                        sliceSuit,
                        players  // Include the players array if needed for the client-side update
                    });
                    if (highestBidder !== null) {
                        startDeclarePhase();
                    }
                }

                if (isBiddingPhase) {
                    // Move to the next player, skipping those who have passed
                    do {
                        currentPlayerTurnBet = (currentPlayerTurnBet + 1) % players.length;
                    } while (passedPlayer[currentPlayerTurnBet] && passedCount < 4);
                }
                // Update all clients with the new state
                io.emit('sliceSuitUpdate', {
                    currentBetNumber,
                    highestBidder,
                    currentPlayerTurnBet,
                    isBiddingPhase,
                    sliceSuit
                });
            }
        }
    });

    // Declare phase
    socket.on('declare', (playerIndex, declareNumber) => {
        if (isDeclarePhase) {
            if (playerIndex === highestBidder && declareNumber < currentBetNumber) {
                socket.emit('declareError', 'Your declare cannot be less than the highest bid');
                return;
            }
            const numOfDeclaredPlayers = declaredPlayers.filter(value => value === true).length;
            if ((declareNumber + sumOfDeclares === 13) && numOfDeclaredPlayers === 3) {
                socket.emit('declareError', 'sum of declares can not be 13');
                return;
            }
            players[playerIndex].declare = declareNumber;
            sumOfDeclares += declareNumber;
            declaredPlayers[playerIndex] = true;

            const allDeclared = declaredPlayers.every(declared => declared);
            if (allDeclared) {
                isDeclarePhase = false;
                declaredPlayers.fill(false); // Reset declaredPlayers
                io.emit('declarePhaseEnded');
            } else {
                currentDeclareTurn = (currentDeclareTurn + 1) % players.length;
                io.emit('updateDeclareTurn', currentDeclareTurn);
            }

            io.emit('playerStats', players); // Update all clients with the latest stats
        }
    });


    socket.on('chooseCard', (playerName: string, chosenCard: any) => {
        if (!choosingCardAllowed) {
            return; // If choosing a card is not allowed, simply return
        }
        const playerIndex = players.findIndex(p => p.name === playerName);
        if (playerIndex === -1 || currentRoundCards.length >= MAX_CARDS_SLOT) {
            return;
        }
        players[playerIndex].cardsHand--;
        currentRoundCards.push({card: chosenCard, playerIndex});
        // currentTurn = (currentTurn + 1) % players.length;
        io.emit('cardChosen', playerName, chosenCard, currentRoundCards);

        if (currentRoundCards.length === MAX_CARDS_SLOT) {
            const winningPlayerIndex = determineHighestCard(currentRoundCards);
            players[winningPlayerIndex].takes++;
            io.emit('playerStats', players); // add new
            io.emit('roundEnded', players, winningPlayerIndex);
            choosingCardAllowed = false; // Disable choosing of cards
            if (allPlayersHandsEmpty()) {
                endRound();
                startGame();
            }
            setTimeout(() => {
                currentRoundCards = [];
                choosingCardAllowed = true; // Re-enable choosing of cards after a delay
                currentTurn = winningPlayerIndex; // Set the winner of the round as the next to play
                io.emit('update-turn', currentTurn); // Emit the updated turn
                io.emit('clearChosenCards');
            }, 3000);
        }

    });

    // socket.on('disconnect', () => {
    //     // Remove player on disconnect
    //     const playerIndex = players.findIndex(p => p.name === currentPlayerName);
    //     if (playerIndex !== -1) {
    //         players.splice(playerIndex, 1);
    //         io.emit('updatePlayers', players.map(p => p.name));
    //         // Reset or adjust game state as necessary
    //     }
    // });

    socket.on('disconnect', () => {
        players = players.filter(player => player.socketId !== socket.id);
        io.emit('updatePlayers', players);
        // Additional game state adjustments can be added here
    })

    // controls turns of players
    socket.on('turn', () => {
        // The player with index 0 is starting.
        // after the player put a card on the table the turn move to the next player.
        // at the end of the round the player who won the round will start the next round.
        // I created a currentTurn with present the index of the player who turn to play.
        // complete the task give me the implementation here and also in the Game.tsx and explain the logic
        currentTurn = (currentTurn + 1) % players.length;
        io.emit('update-turn', currentTurn);
    })

});


// Track the number of connected players
let playerCount = 0;

// Increment player count on new connection and emit the count
io.on('connection', (socket) => {
    playerCount++;
    io.emit('playerCount', playerCount);

    // Decrement player count on disconnection and emit the updated count
    socket.on('disconnect', () => {
        playerCount--;
        io.emit('playerCount', playerCount);
    });
});


function determineHighestCard(currentRoundCards: { card: any; playerIndex: number }[]): number {
    let highestCardIndex = -1;
    let highestCardValue = 0;
    const faceToNumber: { [key: string]: number } = {
        'A': 14,
        'K': 13,
        'Q': 12,
        'J': 11,
        '10': 10,
        '9': 9,
        '8': 8,
        '7': 7,
        '6': 6,
        '5': 5,
        '4': 4,
        '3': 3,
        '2': 2
    };

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

function startBiddingPhase() {
    isBiddingPhase = true;
    currentPlayerTurnBet = 0; // Assuming the bidding starts from the first player
    // Reset other relevant variables if needed
    io.emit('startBiddingPhase', currentPlayerTurnBet);
}

function startDeclarePhase() {
    isDeclarePhase = true;
    currentDeclareTurn = highestBidder !== null ? highestBidder : 0;
    currentTurn = highestBidder !== null ? highestBidder : 0; // Set the currentTurn to the highestBidder
    isBiddingPhase = false; // End bidding phase
    io.emit('startDeclarePhase', currentDeclareTurn);
    io.emit('update-turn', currentTurn); // Notify clients about the new turn
}

function calculateScores(sumOfDeclares: number) {
    players.forEach(player => {
        if (player.takes === player.declare) {
            if (player.declare === 0) {
                if (sumOfDeclares > 13) { // UP
                    player.score += 10;
                } else { // sumOfDeclares < 13 DOWN
                    player.score += 30;
                }
            } else {
                player.score += (player.declare * player.declare + 10);
            }
        } else {
            if (player.declare === 0 && sumOfDeclares < 13) {
                player.score -= (30 - ((Math.abs(player.declare - player.takes) - 1) * 10));
            } else {
                player.score -= (Math.abs(player.declare - player.takes) * 10);
            }
        }
        io.emit('playerStats', players);
        io.emit('updatePlayers', players);
    });
}

// Call this function at the end of a round
function endRound() {
    calculateScores(sumOfDeclares);
    passedPlayer = passedPlayer.map(() => false);
    declaredPlayers = declaredPlayers.map(() => false);
    highestBidder = null;
    currentBetNumber = 0;
    currentBetSuit = '♣';
    sliceSuit = null;
    io.emit('roundReset');
}


function startGame() {
    currentRound++;
    const deck = new Deck();
    deck.shuffle();
    const hands = deck.deal();
    hands.forEach((handOfCards, index) => {
        hands[index] = deck.sortCardsBySuitAndValue(handOfCards);
    });
    // Reset each player's takes, declare, and cardsHand
    players.forEach(player => {
        player.takes = 0;
        player.declare = 0;
        player.cardsHand = 13;
    });
    io.emit('resetTable');
    players.forEach((player, index) => {
        io.to(player.socketId).emit('gameStarted', player.name, hands[index]);
    });
    // Reset bidding phase related variables
    currentPlayerTurnBet = 0;
    isBiddingPhase = true;
    passedPlayer.fill(false);
    highestBidder = null;
    currentBetNumber = 0;
    currentBetSuit = '♣';
    sliceSuit = null;
    // Start the bidding phase
    startBiddingPhase();
    // Emit an event to notify players about the new round
    io.emit('newRoundStarted', currentRound);
}

function allPlayersHandsEmpty() {
    return players.every(player => player.cardsHand === 0);
}


const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
