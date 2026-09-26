// Bot strength profiles.
// Lower bots deliberately make human-like mistakes; the final bot uses
// full-strength Stockfish with no Elo limiter and a mate-first safeguard.

const difficulty = {
  talc: {
    name: "Talc Rockey", skill: 0, elo: 400, depth: 3, movetime: 80,
    randomChance: 0.78, candidateCount: 5
  },
  sleep: {
    name: "Sleeping Rockey", skill: 2, elo: 650, depth: 5, movetime: 120,
    randomChance: 0.42, candidateCount: 5
  },
  fur: {
    name: "Beginner Rockey", skill: 5, elo: 950, depth: 8, movetime: 180,
    randomChance: 0.16, candidateCount: 4
  },
  rockey: {
    name: "Normal Rockey", skill: 9, elo: 1300, depth: 11, movetime: 260,
    randomChance: 0.06, candidateCount: 3
  },
  army: {
    name: "Advanced Rockey", skill: 14, elo: 1750, depth: 14, movetime: 420,
    randomChance: 0.015, candidateCount: 2
  },
  doronum: {
    name: "Master Rockey", skill: 20, elo: 2200, depth: 17, movetime: 700,
    randomChance: 0, candidateCount: 1
  },
  brilliant: {
    name: "Brilliant Rockey",
    skill: 20,
    elo: 3200,
    depth: 22,
    movetime: 1800,
    randomChance: 0,
    candidateCount: 1,
    fullStrength: true
  }
};

export default difficulty;
