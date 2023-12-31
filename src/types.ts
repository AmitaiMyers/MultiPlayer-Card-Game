import {Card} from "./Card";

export interface Player {
    name: string;
    index: number;
    socketId: string;
    declare: number;
    takes: number;
    score: number;
    cardsHand: number;
    hand:Card[];
}
