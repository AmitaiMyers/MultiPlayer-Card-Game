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
    const [players, setPlayers] = useState<string[]>([]);
    const [hasJoined, setHasJoined] = useState<boolean>(false);
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
    const [playerCards, setPlayerCards] = useState<Card[]>([]);
    const [chosenCards, setChosenCards] = useState<Card[]>([]);
    const [currentTurnPlayer, setCurrentTurnPlayer] = useState<number>(0);
    const [playerStats, setPlayerStats] = useState<Player[]>([]);
    const [canChooseCard, setCanChooseCard] = useState<boolean>(true);
   // Slice suit
    const [isSliceSuitPhase, setIsSliceSuitPhase] = useState<boolean>(true);
    const [currentBid, setCurrentBid] = useState<number>(0);
    const [highestBet, setHighestBet] = useState<{ amount: number, player: number | null }>({ amount: 0, player: null });
    const [currentPlayerTurnToBid, setCurrentPlayerTurnToBid] = useState<number>(0);
    const [currentBetSuit, setCurrentBetSuit] = useState<string>('♣');
    const [currentSliceSuit, setCurrentSliceSuit] = useState<string>('♣');
    const [declarePlayers, setDeclarePlayers] = useState<number[]>([]);
    const [takePlayers, setTakePlayers] = useState<number[]>([]);
    const [scorePlayers, setScorePlayers] = useState<number[]>([]);

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
                {players.map((player, index) => (
                    <tr key={index}>
                        <td>{player}</td>
                        <td>{declarePlayers[index]}</td>
                        <td>{takePlayers[index]}</td>
                        <td>{scorePlayers[index]}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        );
    };



    const getPlayerPosition = (playerName: string) => {
        if (playerName === currentPlayer) return "bottom";
        const index = players.indexOf(playerName);
        const currentPlayerIndex = players.indexOf(currentPlayer as string);
        if (index === (currentPlayerIndex + 1) % players.length) return "right";
        if (index === (currentPlayerIndex + 2) % players.length) return "top";
        return "left";
    };


    useEffect(() => {
        socket.on('updatePlayers', (updatedPlayers: string[]) => {
            setPlayers(updatedPlayers);
            setDeclarePlayers(new Array(updatedPlayers.length).fill(-1));
            setTakePlayers(new Array(updatedPlayers.length).fill(0));
            setScorePlayers(new Array(updatedPlayers.length).fill(0));
        });
        socket.on('gameStarted', (playerName: string, cards: Card[]) => {
            console.log('Game started for player:', playerName);
            setGameStarted(true);
            if (currentPlayer === playerName) {
                setPlayerCards(cards);
            }
        });

        return () => {
            socket.off('updatePlayers');
        };

    }, [currentPlayer]);


    // Slice suit phase
    useEffect(() => {
        socket.on('sliceSuitUpdate', (data) => {
            setIsSliceSuitPhase(data.isBiddingPhase);
            setHighestBet({ amount: data.currentBetNumber, player: data.highestBidder });
            setCurrentPlayerTurnToBid(data.currentPlayerTurnBet);
            setCurrentSliceSuit(data.sliceSuit);
            setPlayerStats(data.players);  // Update player stats to reflect the changes
            // ... [other state updates] ...
        });
    }, [socket]);

    const handleBid = () => {
        if (currentPlayer === players[currentPlayerTurnToBid]) {
            socket.emit('sliceSuitBid', currentPlayerTurnToBid, {number:currentBid, suit:currentBetSuit});
        } else {
            alert("It's not your turn to bid.");
        }
    };

    const handlePass = () => {
        if (currentPlayer === players[currentPlayerTurnToBid]) {
            socket.emit('sliceSuitBid', currentPlayerTurnToBid, null);
        } else {
            alert("It's not your turn to bid.");
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
            setPlayerStats(updatedPlayers); // Assuming playerStats is the state that holds the data for rendering the table

        });

        // Cleanup listener on component unmount
        return () => {
            socket.off('roundEnded');
        };
    }, [socket]);

    useEffect(() => {
        socket.on('clearChosenCards', () => {
            setChosenCards([]); // Assuming setChosenCards is the state setter for chosenCards
            setCanChooseCard(true);
        });

        // Cleanup listener on component unmount
        return () => {
            socket.off('clearChosenCards');
        };

    }, [socket]);


    useEffect(() => {
        const handlePlayerStats = (stats: React.SetStateAction<Player[]>) => {
            setPlayerStats(stats);
        };

        socket.on('playerStats', handlePlayerStats);

        // Return a cleanup function to remove the event listener when the component unmounts
        return () => {
            socket.off('playerStats', handlePlayerStats);
        };
    }, [socket]);

    useEffect(() => {
        socket.on('update-turn', (turnIndex: number) => {
            setCurrentTurnPlayer(turnIndex);
        });
        return () => {
            socket.off('update-turn');
        }
    }, [socket]);
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
        if(isSliceSuitPhase){
            alert("Choose a suit to slice.");
            return;
        }
        if (!canChooseCard) {
            alert("Wait for the cards to be cleared.");
            return;
        }
        if (players[currentTurnPlayer] !== currentPlayer) {
            alert("Wait for your turn.");
            return;
        } else {

            // Emit the 'chooseCard' event with the chosen card
            socket.emit('chooseCard', currentPlayer, chosenCard);
            if (chosenCards.length < 4) {
                socket.emit('turn', currentTurnPlayer);
            } else {
                socket.emit('roundEnded',)
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
                Current player turn: {players[currentTurnPlayer]}
                <br/>
                Current player : {currentPlayer}
                <br/>
                {isSliceSuitPhase && (
                    <div>
                        Current player's turn to bid: Player {players[currentPlayerTurnToBid]}
                    </div>
                )}
                <br/>
                {!isSliceSuitPhase && gameStarted && (
                    <div>
                        Current slice suit: {currentSliceSuit}
                    </div>

                )}

            </div>
            {gameStarted ? (
                <div className="game-board">
                    {players.map((player) => (
                        <PlayerHand
                            key={player}
                            playerName={player}
                            cards={playerCards}
                            currentPlayer={currentPlayer}
                            position={getPlayerPosition(player)}
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
                                Current Highest Bet: {highestBet.amount} {currentBetSuit} by
                                Player {highestBet.player !== null ? players[highestBet.player] : 'N/A'}
                            </div>
                            <br/>
                            <input
                                type="number"
                                value={currentBid}
                                onChange={(e) => setCurrentBid(Number(e.target.value))}
                            />
                            <select
                                className="bet-input"
                                value={currentBetSuit}
                                onChange={(e) => setCurrentBetSuit(e.target.value)}
                            >
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
                                <li key={index}>{player}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Game;
