import React, {useEffect, useState} from 'react';
import io from 'socket.io-client';
import {Card} from './Card';
import './styles.css';


const socket = io('http://localhost:3001'); // Update with your server's address

const suitPriority: { [key: string]: number } = {
    '♣': 1,
    '♦': 2,
    '♥': 3,
    '♠': 4,
};

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
                const cardAlreadyChosen = prevChosenCards.some(card => card.suit === chosenCard.suit && card.value === chosenCard.value);
                if (!cardAlreadyChosen) {
                    return [...prevChosenCards, chosenCard];
                }
                return prevChosenCards;
            });

            if (playerName === currentPlayer) {
                setPlayerCards(prevPlayerCards => prevPlayerCards.filter(card => card.suit !== chosenCard.suit || card.value !== chosenCard.value));
            }

            const nextTurn = (currentTurn + 1) % players.length;
            setCurrentTurn(nextTurn);
        });
    }, [currentPlayer, currentTurn, players.length]);



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
