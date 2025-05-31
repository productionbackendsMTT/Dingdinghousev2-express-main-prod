
export interface gambleResponse {
  playerWon: boolean,
  currentWinning: number,
  cardId: number,
  balance: number,
}
type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
type Value = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Card = { suit: Suit; value: Value };

/*
 * function for gamble feature for SL-LOL
 * on a win player can choose to gamble ie double or nothing 
 * on loss player will lose current win 
 *
 *
 * */
export function sendInitGambleData() {
  // console.log("gamble init");
  let gambleData: {
    blCard: Card,
    rdCard: Card
  } = {
    blCard: {
      suit: 'Spades',
      value: 'A'
    },
    rdCard: {
      suit: 'Hearts',
      value: 'A'
    }
  }
  return gambleData
}

export function getGambleResult(response: {
  selected: "BLACK" | "RED"
})
  : gambleResponse {
  // console.log("gamble result", response);
  const result = getRandomCard()


  switch (response.selected === result) {
    case true:
      return {
        playerWon: true,
        currentWinning: 0,
        cardId: result === "RED" ? (Math.random() >= 0.5 ? 0 : 1) : (Math.random() >= 0.5 ? 2 : 3),
        balance: 0
      }
    case false:
      return {
        playerWon: false,
        currentWinning: 0,
        cardId: result === "RED" ? (Math.random() >= 0.5 ? 0 : 1) : (Math.random() >= 0.5 ? 2 : 3),
        balance: 0,
      }
  }
}
// function to get random card
export function getRandomCard(): "RED" | "BLACK" {
  return Math.random() >= 0.5 ? "RED" : "BLACK"
}
