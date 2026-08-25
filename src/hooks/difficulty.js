// src/hooks/difficulty.js

const difficulty = {
    // ==========================
    // TALC ROCKEY
    // ==========================
    talc: {
        name: "Talc Rockey",

        // Stockfish
        skill: 0,
        elo: 100,
        depth: 1,
        movetime: 35,
        candidateCount: 4,

        // 실수 확률
        brilliantChance: 0.00,
        greatChance: 0.00,
        bestChance: 0.05,
        excellentChance: 0.10,
        goodChance: 0.25,

        inaccuracyChance: 0.35,
        mistakeChance: 0.60,
        blunderChance: 0.85,

        // 플레이 스타일
        randomness: 1.00,
        sacrificeChance: 0.00,
        attackChance: 0.15,
        defendChance: 0.95,
        openingKnowledge: 0.00,
        endgameKnowledge: 0.00,
        humanLike: true
    },

    // ==========================
    sleep: {
        name: "Sleep Rockey",

        skill: 1,
        elo: 200,
        depth: 1,
        movetime: 50,
        candidateCount: 4,

        brilliantChance: 0.00,
        greatChance: 0.00,
        bestChance: 0.10,
        excellentChance: 0.20,
        goodChance: 0.35,

        inaccuracyChance: 0.30,
        mistakeChance: 0.45,
        blunderChance: 0.60,

        randomness: 0.90,
        sacrificeChance: 0.02,
        attackChance: 0.20,
        defendChance: 0.80,
        openingKnowledge: 0.05,
        endgameKnowledge: 0.05,
        humanLike: true
    },

    // ==========================
    fur: {
        name: "Beginner Rockey",

        skill: 3,
        elo: 450,
        depth: 2,
        movetime: 70,
        candidateCount: 4,

        brilliantChance: 0.01,
        greatChance: 0.05,
        bestChance: 0.30,
        excellentChance: 0.50,
        goodChance: 0.80,

        inaccuracyChance: 0.20,
        mistakeChance: 0.25,
        blunderChance: 0.25,

        randomness: 0.50,
        sacrificeChance: 0.05,
        attackChance: 0.35,
        defendChance: 0.65,
        openingKnowledge: 0.20,
        endgameKnowledge: 0.20,
        humanLike: true
    },

    // ==========================
    rockey: {
        name: "Normal Rockey",

        skill: 6,
        elo: 900,
        depth: 3,
        movetime: 110,
        candidateCount: 5,

        brilliantChance: 0.05,
        greatChance: 0.10,
        bestChance: 0.60,
        excellentChance: 0.90,
        goodChance: 1.00,

        inaccuracyChance: 0.10,
        mistakeChance: 0.12,
        blunderChance: 0.10,

        randomness: 0.25,
        sacrificeChance: 0.10,
        attackChance: 0.50,
        defendChance: 0.60,
        openingKnowledge: 0.50,
        endgameKnowledge: 0.40,
        humanLike: true
    },

    // ==========================
    army: {
        name: "Advanced Rockey",

        skill: 10,
        elo: 1400,
        depth: 4,
        movetime: 160,
        candidateCount: 5,

        brilliantChance: 0.15,
        greatChance: 0.35,
        bestChance: 0.90,
        excellentChance: 1.00,
        goodChance: 1.00,

        inaccuracyChance: 0.02,
        mistakeChance: 0.03,
        blunderChance: 0.02,

        randomness: 0.08,
        sacrificeChance: 0.20,
        attackChance: 0.65,
        defendChance: 0.70,
        openingKnowledge: 0.80,
        endgameKnowledge: 0.70,
        humanLike: true
    },

    // ==========================
    doronum: {
        name: "Master Rockey",

        skill: 14,
        elo: 2200,
        depth: 5,
        movetime: 220,
        candidateCount: 5,

        brilliantChance: 0.45,
        greatChance: 0.80,
        bestChance: 1.00,
        excellentChance: 1.00,
        goodChance: 1.00,

        inaccuracyChance: 0.00,
        mistakeChance: 0.00,
        blunderChance: 0.00,

        randomness: 0.01,
        sacrificeChance: 0.50,
        attackChance: 0.85,
        defendChance: 0.90,
        openingKnowledge: 1.00,
        endgameKnowledge: 1.00,
        humanLike: false
    },

    // ==========================
    brilliant: {
        name: "Legend Rockey",

        skill: 20,
        elo: 3200,
        depth: 6,
        movetime: 600,
        candidateCount: 6,

        brilliantChance: 1.00,
        greatChance: 1.00,
        bestChance: 1.00,
        excellentChance: 1.00,
        goodChance: 1.00,

        inaccuracyChance: 0.00,
        mistakeChance: 0.00,
        blunderChance: 0.00,

        randomness: 0.00,
        sacrificeChance: 0.80,
        attackChance: 0.95,
        defendChance: 0.95,
        openingKnowledge: 1.00,
        endgameKnowledge: 1.00,
        humanLike: false
    }
};

export default difficulty;