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


const PlayerHand: React.FC<PlayerHandProps & { position: string, onCardClick: (card: Card) => void }> = ({ cards, playerName, currentPlayer, position, onCardClick }) => {

    return (
        <div className={`player ${position}`}>
            <h3>{playerName}</h3>
            {currentPlayer === playerName && (
                <div className="cards">
                    {cards.map((card, index) => (
                        <div key={index} className={`card ${card.suit === '♠' || card.suit === '♣' ? 'black' : 'red'}`} onClick={() => onCardClick(card)}>
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
    const [currentTurn, setCurrentTurn] = useState<number>(0);
    const [playerStats,setPlayerStats] = useState<Player[]>([]);


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
                {playerStats.map((player, index) => (
                    <tr key={index}>
                        <td>{player.name}</td>
                        <td>{player.guess}</td>
                        <td>{player.takes}</td>
                        <td>{player.score}</td>
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
        });
        socket.on('gameStarted', (playerName: string, cards: Card[]) => {
            console.log('Game started for player:', playerName);
            setGameStarted(true);
            if (currentPlayer === playerName) {
                setPlayerCards(cards);
            }
        });

    }, [currentPlayer]);

    useEffect(() => {
        socket.on('updateTurn', (playerName: string) => {
            const nextTurn = players.findIndex(p => p === playerName);
            setCurrentTurn(nextTurn);
        });
    }, [players]);

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

            if(playerName === currentPlayer && chosenCards.length < 4) {
                setPlayerCards(prevPlayerCards => {
                    return prevPlayerCards.filter(card => card.suit !== chosenCard.suit || card.value !== chosenCard.value);
                });
            }

            // After a card is chosen, check if there are now 4 cards to determine if the round should end
            // if (chosenCards.length === 4) {
            //     // Emit an event to the server to handle the end of the round
            //     // socket.emit('endRound', ...); // You will need to implement this on the server-side
            // }

            // Handling the turn should be separate from adding a card
            const nextTurn = (currentTurn + 1) % players.length;
            setCurrentTurn(nextTurn);
        });

        // Clean up the event listener when the component unmounts
        return () => {
            socket.off('cardChosen');
        };
    }, [currentPlayer, currentTurn, players.length, chosenCards.length, socket]);

    useEffect(() => {
        socket.on('roundEnded', (updatedPlayers) => {
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
        if (currentPlayer !== players[currentTurn]) {
            alert("It's not your turn!");
            return;
        }

        socket.emit('chooseCard', currentPlayer, chosenCard);
    };



    return (
        <div className="game-container">
            <h1>Whist Game</h1>
            <div className="stats-container">
                {renderStatsTable()}
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
                            <div key={index} className={`card ${card.suit === '♠' || card.suit === '♣' ? 'black' : 'red'}`}>
                                <span className="value">{card.value}</span>
                                <span className="suit">{card.suit}</span>
                            </div>
                        ))}
                    </div>

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
