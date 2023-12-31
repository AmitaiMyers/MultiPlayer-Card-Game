import React, {useEffect, useState} from 'react';
import io from 'socket.io-client';
import {Card} from './Card';
import './styles.css';
import {Player} from "./types";


const socket = io('http://localhost:3001'); // Update with your server's address


interface PlayerHandProps {
    cards: Card[];
    playerName: string;
    currentPlayer: string | null;
}


const PlayerHand: React.FC<PlayerHandProps & { position: string, onCardClick: (card: Card) => void }> = ({
                                                                                                             cards,
                                                                                                             playerName,
                                                                                                             currentPlayer,
                                                                                                             position,
                                                                                                             onCardClick
                                                                                                         }) => {

    return (
        <div className={`player ${position}`}>
            <h3>{playerName}</h3>
            {currentPlayer === playerName && (
                <div className="cards">
                    {cards.map((card, index) => (
                        <div key={index} className={`card ${card.suit === '♠' || card.suit === '♣' ? 'black' : 'red'}`}
                             onClick={() => onCardClick(card)}>
                            <span className="value">{card.value}</span>
                            <span className="suit">{card.suit}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Game: React.FC = () => {
    // const [players, setPlayers] = useState<Player[]>([]);

    const [players, setPlayers] = useState<Player[]>([]);
    const [currentRound, setCurrentRound] = useState(0);
    const [hasJoined, setHasJoined] = useState<boolean>(false);
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
    const [playerCards, setPlayerCards] = useState<Card[]>([]);
    const [chosenCards, setChosenCards] = useState<Card[]>([]);
    const [currentTurnPlayer, setCurrentTurnPlayer] = useState<number>(0);
    // const [playerStats, setPlayerStats] = useState<Player[]>([]);
    const [canChooseCard, setCanChooseCard] = useState<boolean>(true);
    // Slice suit
    const [isSliceSuitPhase, setIsSliceSuitPhase] = useState<boolean>(true);
    const [currentBid, setCurrentBid] = useState<number>(0);
    const [highestBet, setHighestBet] = useState<{ amount: number, player: number | null }>({amount: 0, player: null});
    const [currentPlayerTurnToBid, setCurrentPlayerTurnToBid] = useState<number>(0);
    const [currentBetSuit, setCurrentBetSuit] = useState<string>('♣');
    const [currentSliceSuit, setCurrentSliceSuit] = useState<string | null>('♣');
    // Declare phase
    const [isDeclarePhase, setIsDeclarePhase] = useState<boolean>(false);
    const [currentDeclareTurn, setCurrentDeclareTurn] = useState<number>(0);
    const [declareNumber, setDeclareNumber] = useState<number>(0); // State to store the declare number

    const renderStatsTable = () => {
        return (
            <table className="stats-table">
                <thead>
                <tr>
                    <th>Player Name</th>
                    <th>Declare</th>
                    <th>Take</th>
                    <th>Score</th>
                </tr>
                </thead>
                <tbody>
                {players.map((player, index) => {
                    return (
                        <tr key={index}>
                            <td>{player.name}</td>
                            <td>{player.declare}</td>
                            <td>{player.takes}</td>
                            <td>{player.score}</td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        );
    };

    useEffect(() => {
        const handlePlayerStats = (updatedPlayers: React.SetStateAction<Player[]>) => {
            setPlayers(updatedPlayers); // Update players state
        };

        socket.on('playerStats', handlePlayerStats);

        return () => {
            socket.off('playerStats', handlePlayerStats);
        };
    }, []);

    const getPlayerPosition = (playerName: string) => {
        if (playerName === currentPlayer) return "bottom";

        const index = players.findIndex(player => player.name === playerName);
        const currentPlayerIndex = players.findIndex(player => player.name === currentPlayer);

        if (index === -1 || currentPlayerIndex === -1) return "unknown"; // or some default position

        if (index === (currentPlayerIndex + 1) % players.length) return "left";
        if (index === (currentPlayerIndex + 2) % players.length) return "top";
        return "right";
    };


    useEffect(() => {
        socket.on('updatePlayers', (updatedPlayers: Player[]) => {
            setPlayers(updatedPlayers);
        });

        return () => {
            socket.off('updatePlayers');
        };

    }, [currentPlayer]);

    useEffect(() => {
        socket.on('gameStarted', (playerName: string, cards: Card[]) => {
            console.log('Game started for player:', playerName);
            setGameStarted(true);
            if (currentPlayer === playerName) {
                setPlayerCards(cards); // Set the current player's cards
            }
        });

        return () => {
            socket.off('gameStarted');
        };

    }, [currentPlayer]);


    // Slice suit phase
    useEffect(() => {
        socket.on('sliceSuitUpdate', (data) => {
            setIsSliceSuitPhase(data.isBiddingPhase);
            setCurrentBetSuit(data.currentBetSuit);
            setHighestBet({amount: data.currentBetNumber, player: data.highestBidder});
            setCurrentPlayerTurnToBid(data.currentPlayerTurnBet);
            setCurrentSliceSuit(data.sliceSuit);
            // setPlayerStats(data.players);  // Update player stats to reflect the changes
            setPlayers(data.players);
            // ... [other state updates] ...
        });
    }, []);

    //add new useEffect for the slice suit phase
    useEffect(() => {
        socket.on('startBiddingPhase', (currentPlayerTurnBet) => {
            setIsSliceSuitPhase(true);
            setCurrentPlayerTurnToBid(currentPlayerTurnBet);
        });
        return () => {
            socket.off('startBiddingPhase');
        };
    }, []);

    useEffect(() => {
        socket.on('declareError', (errorMessage) => {
            alert(errorMessage); // or handle the error in a more sophisticated way
        });

        return () => {
            socket.off('declareError');
        };
    }, []);

    // need to implement this for the new round
    useEffect(() => {
        socket.on('newRoundStarted', (roundNumber) => {
            console.log('New round started');
            setCurrentRound(roundNumber);
            // Handle new round logic here, e.g., resetting state
            setChosenCards([]);
            // ... other state resets as needed ...
        });

        return () => {
            socket.off('newRoundStarted');
        };
    }, []);

    useEffect(() => {
        socket.on('roundReset', (updatedPlayers) => {
            setPlayers(updatedPlayers);
            // setPlayerStats(updatedPlayers);
            // Reset client-side state variables
            setHighestBet({amount: 0, player: null});
            setCurrentBid(0);
            setCurrentBetSuit('♣');
            setCurrentSliceSuit(null);
        });

        return () => {
            socket.off('roundReset');
        };
    }, []);


    const handleBid = () => {
        if (currentBid < 5) {
            alert("No bid under 5 is allowed.");
            return;
        }
        // Check if the currentPlayer exists in the players array and get their index
        const currentPlayerIndex = players.findIndex(player => player.name === currentPlayer);

        if (currentPlayerIndex !== -1 && currentPlayerIndex === currentPlayerTurnToBid) {
            socket.emit('sliceSuitBid', currentPlayerTurnToBid, {number: currentBid, suit: currentBetSuit});
        } else {
            alert("It's not your turn to bid.");
        }
    };


    const handlePass = () => {
        // Check if the currentPlayer exists in the players array and get their index
        const currentPlayerIndex = players.findIndex(player => player.name === currentPlayer);

        if (currentPlayerIndex !== -1 && currentPlayerIndex === currentPlayerTurnToBid) {
            socket.emit('sliceSuitBid', currentPlayerTurnToBid, null);
        } else {
            alert("It's not your turn to bid.");
        }
    };


    useEffect(() => {
        socket.on('startDeclarePhase', (declareTurnIndex) => {
            setIsDeclarePhase(true);
            setCurrentDeclareTurn(declareTurnIndex);
        });
    }, []);

    useEffect(() => {
        socket.on('declarePhaseEnded', () => {
            setIsDeclarePhase(false);
        });

        return () => {
            socket.off('declarePhaseEnded');
        };
    }, []);

    useEffect(() => {
        socket.on('updateDeclareTurn', (newDeclareTurn) => {
            setCurrentDeclareTurn(newDeclareTurn);
        });

        return () => {
            socket.off('updateDeclareTurn');
        };
    }, []);


    const handleDeclareSubmit = () => {
        if (declareNumber < 0) {
            alert("HAHA.");
            return;
        }
        // Find the index of the current player in the players array
        const currentPlayerIndex = players.findIndex(player => player.name === currentPlayer);

        if (currentPlayerIndex !== -1 && currentPlayerIndex === currentDeclareTurn) {
            socket.emit('declare', currentDeclareTurn, declareNumber);
        } else {
            alert("It's not your turn to declare.");
        }
    };


    // cardChosen event listener
    useEffect(() => {
        socket.on('cardChosen', (playerName: string, chosenCard: Card) => {
            setChosenCards(prevChosenCards => {
                // Check if the card is already chosen
                const cardAlreadyChosen = prevChosenCards.some(card => card.suit === chosenCard.suit && card.value === chosenCard.value);
                // If the card is not already chosen and there are less than 4 cards, add the card
                if (!cardAlreadyChosen && prevChosenCards.length < 4) {
                    return [...prevChosenCards, chosenCard];
                }
                return prevChosenCards; // Otherwise, return the previous array without change
            });

            if (playerName === currentPlayer && chosenCards.length < 4) {
                setPlayerCards(prevPlayerCards => {
                    return prevPlayerCards.filter(card => card.suit !== chosenCard.suit || card.value !== chosenCard.value);
                });
            }

        });

        // Clean up the event listener when the component unmounts
        return () => {
            socket.off('cardChosen');
        };
    }, [players, currentPlayer, chosenCards.length]);

    useEffect(() => {
        socket.on('roundEnded', (updatedPlayers, winningPlayerIndex) => {
            // setPlayerStats(updatedPlayers); // Assuming playerStats is the state that holds the data for rendering the table
            setPlayers(updatedPlayers);
        });

        // Cleanup listener on component unmount
        return () => {
            socket.off('roundEnded');
        };
    }, []);

    useEffect(() => {
        socket.on('clearChosenCards', () => {
            setChosenCards([]); // Assuming setChosenCards is the state setter for chosenCards
            setCanChooseCard(true);
        });

        // Cleanup listener on component unmount
        return () => {
            socket.off('clearChosenCards');
        };

    }, []);
    // reset table after each round
    useEffect(() => {
        socket.on('resetTable', () => {
            setPlayers(players.map(player => ({
                ...player,
                declare: 0,
                takes: 0,
            })));
            setCurrentBid(0);
            setCurrentBetSuit('♣');
            setDeclareNumber(0);
        });

        return () => {
            socket.off('resetTable');
        };
    }, [players]);


    useEffect(() => {
        const handlePlayerStats = (updatedStats: React.SetStateAction<Player[]>) => {
            // setPlayerStats(updatedStats);
            setPlayers(updatedStats);
        };

        socket.on('playerStats', handlePlayerStats);

        return () => {
            socket.off('playerStats', handlePlayerStats);
        };
    }, []);


    useEffect(() => {
        socket.on('update-turn', (turnIndex: number) => {
            setCurrentTurnPlayer(turnIndex);
        });
        return () => {
            socket.off('update-turn');
        }
    }, []);

    useEffect(() => {
        socket.on('chooseCardError', (errorMessage) => {
            alert(errorMessage);
        });

        return () => {
            socket.off('chooseCardError');
        };
    }, []);

    const handleJoinGame = () => {
        if (!hasJoined) {
            const playerName = prompt('Enter your name:');
            if (playerName) {
                socket.emit('joinGame', playerName);
                setHasJoined(true);
                setCurrentPlayer(playerName); // Set the current player
            }
        } else {
            alert('You have already joined the game.');
        }
    };

    const handleCardClick = (chosenCard: Card) => {
        console.log("Current Player: ", currentPlayer);
        console.log("Current Turn Index: ", currentTurnPlayer);
        console.log("Player at Current Turn: ", players[currentTurnPlayer]);

        if (isSliceSuitPhase) {
            alert("Choose a suit to slice.");
            return;
        }

        if (isDeclarePhase) {
            alert("Declare phase is ongoing.");
            return;
        }

        if (!canChooseCard) {
            alert("Wait for the cards to be cleared.");
            return;
        }

        // Compare the currentPlayer's name with the name of the player whose turn it is
        if (players[currentTurnPlayer]?.name !== currentPlayer) {
            alert("Wait for your turn.");
            return;
        } else {
            // Emit the 'chooseCard' event with the chosen card
            socket.emit('chooseCard', currentPlayer, chosenCard);

            if (chosenCards.length < 4) {
                socket.emit('turn', currentTurnPlayer);
            } else {
                socket.emit('roundEnded');
            }
        }
    };

    // State to keep track of the number of connected players
    const [playerCount, setPlayerCount] = useState(0);

// Listen for player count updates from the server
    useEffect(() => {
        socket.on('playerCount', count => {
            setPlayerCount(count);
        });

        return () => {
            socket.off('playerCount');
        };
    }, []);


    return (
        <div className="game-container">
            <h2>Players Connected: {playerCount}</h2>
            <h1>Whist Game</h1>
            <div className="stats-container">
                {renderStatsTable()}
                <div className="top-right-container">
                    Player turn: {players[currentTurnPlayer]?.name}
                    <br/>
                    Player: {currentPlayer}
                    <br/>
                    {isSliceSuitPhase && (
                        <div>
                            Player's turn to bid: Player {players[currentPlayerTurnToBid]?.name}
                        </div>
                    )}
                    {isDeclarePhase && (
                        <div>
                            Player to declare: {players[currentDeclareTurn]?.name}
                        </div>
                    )}
                    <br/>
                    {!isSliceSuitPhase && gameStarted && (
                        <div>
                            Slice suit: {currentSliceSuit}
                            <br/>
                            leading suit: {chosenCards[0]?.suit}
                        </div>
                    )}
                    <h2>Round: {currentRound}</h2>
                </div>

            </div>

            {gameStarted ? (
                <div className="game-board">
                    {players.map((player, index) => (
                        <PlayerHand
                            key={index}
                            playerName={player.name}
                            cards={player.name === currentPlayer ? playerCards : player.hand} // Pass the correct hand
                            currentPlayer={currentPlayer}
                            position={getPlayerPosition(player.name)}
                            onCardClick={handleCardClick}
                        />
                    ))}
                    <div className="center-cards">
                        {chosenCards.map((card, index) => (
                            <div key={index}
                                 className={`card ${card.suit === '♠' || card.suit === '♣' ? 'black' : 'red'}`}>
                                <span className="value">{card.value}</span>
                                <span className="suit">{card.suit}</span>
                            </div>
                        ))}
                    </div>
                    {isSliceSuitPhase && (
                        <div className="bidding-section">
                            <div>
                                Highest Bet: {highestBet.amount} {currentBetSuit} by
                                Player {highestBet.player !== null ? players[highestBet.player]?.name : 'N/A'}
                            </div>
                            <br/>
                            <input type="number" value={currentBid}
                                   onChange={(e) => setCurrentBid(Number(e.target.value))}
                                   min="0"
                                   max="13"/>
                            <select className="bet-input" value={currentBetSuit}
                                    onChange={(e) => setCurrentBetSuit(e.target.value)}>
                                <option value="♣">♣</option>
                                <option value="♦">♦</option>
                                <option value="♥">♥</option>
                                <option value="♠">♠</option>
                            </select>
                            <button onClick={handleBid}>Place Bid</button>
                            <button onClick={handlePass}>Pass</button>
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <button onClick={handleJoinGame}>Join Game</button>
                    <div>
                        <h2>Players</h2>
                        <ul>
                            {players.map((player, index) => (
                                <li key={index}>{player.name}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
            {gameStarted && isDeclarePhase && (
                <div className="declare-section">
                    <div>
                        Player's turn to declare: Player {players[currentDeclareTurn]?.name}
                    </div>
                    <input type="number" value={declareNumber}
                           onChange={(e) => setDeclareNumber(Number(e.target.value))}
                           min="0"
                           max="13"/>
                    <button onClick={handleDeclareSubmit}>Submit Declare</button>
                </div>
            )}
        </div>
    );
}

export default Game;
