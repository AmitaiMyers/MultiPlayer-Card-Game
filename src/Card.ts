// Card.tsx

const SUITS = ["♠", "♣", "♥", "♦"] as const;
const VALUES = [
    "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"
] as const;

type Suit = typeof SUITS[number];
type Value = typeof VALUES[number];

interface Card {
    suit: Suit;
    value: Value;
}

class Card {
    constructor(suit: Suit, value: Value) {
        this.suit = suit;
        this.value = value;
    }
}

export class Deck {
    cards: Card[];

    constructor() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const value of VALUES) {
                this.cards.push(new Card(suit, value));
            }
        }
    }

    generateDeck() {
        for (const suit of SUITS) {
            for (const value of VALUES) {
                this.cards.push(new Card(suit, value));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        if (this.cards.length !== 52) {
            throw new Error("The deck needs to be shuffled before dealing");
        }

        const hands: Card[][] = [[], [], [], []];
        for (let i = 0; i < 52; i++) {
            hands[i % 4].push(this.cards[i]);
        }
        return hands;
    }

    sortCardsBySuitAndValue(cards: Card[]): Card[] {
        const customSuitOrder = ['♠', '♥', '♣', '♦'];
        const customValueOrder = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];  // Reversed value order

        return cards.sort((a, b) => {
            const suitOrder = customSuitOrder.indexOf(a.suit) - customSuitOrder.indexOf(b.suit);
            if (suitOrder !== 0) return suitOrder;

            return customValueOrder.indexOf(b.value) - customValueOrder.indexOf(a.value);
        });
    }
}

export {Card, SUITS, VALUES,};