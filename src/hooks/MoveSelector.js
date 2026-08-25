// MoveSelector.js

import difficulty from "./difficulty";

// ========================================
// Stockfish 후보 수
// ========================================

let candidateMoves = [];


// ========================================
// Stockfish info 파싱
// ========================================

export function parseEngineLine(line) {

    if (!line || !line.startsWith("info")) {
        return;
    }

    const multi =
        line.match(/\bmultipv\s+(\d+)/);

    const pv =
        line.match(
            /\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/
        );

    if (!multi || !pv) {
        return;
    }

    const multipv =
        Number(multi[1]);

    // cp 또는 mate 둘 중 하나
    const cpMatch =
        line.match(/\bscore\s+cp\s+(-?\d+)/);

    const mateMatch =
        line.match(/\bscore\s+mate\s+(-?\d+)/);

    let score = 0;
    let mate = null;

    if (cpMatch) {

        score =
            Number(cpMatch[1]);

    }

    if (mateMatch) {

        mate =
            Number(mateMatch[1]);

    }

    candidateMoves[multipv - 1] = {

        move: pv[1],

        score,

        mate,

        multipv

    };
}


// ========================================
// 후보 수 초기화
// ========================================

export function clearCandidates() {

    candidateMoves = [];

}


// ========================================
// 후보 수 가져오기
// ========================================

export function getCandidates() {

    return candidateMoves
        .filter(Boolean)
        .sort((a, b) => {

            // Mate가 있으면 mate 우선
            if (a.mate !== null && b.mate !== null) {

                return b.mate - a.mate;

            }

            if (a.mate !== null) {
                return -1;
            }

            if (b.mate !== null) {
                return 1;
            }

            return (
                b.score - a.score ||
                a.multipv - b.multipv
            );

        });

}


// ========================================
// 랜덤
// ========================================

function pickRandom(list) {

    if (!list || list.length === 0) {
        return null;
    }

    return list[
        Math.floor(
            Math.random() * list.length
        )
    ];

}


// ========================================
// 점수 가중 랜덤
// ========================================

function pickWeightedByScore(list) {

    if (!list || list.length === 0) {
        return null;
    }

    if (list.length === 1) {
        return list[0];
    }

    const scores =
        list.map(x =>
            x.mate !== null
                ? 1000000 - Math.abs(x.mate) * 10000
                : x.score
        );

    const minScore =
        Math.min(...scores);

    const weights =
        scores.map(score =>
            Math.max(
                1,
                score - minScore + 1
            )
        );

    const total =
        weights.reduce(
            (a, b) => a + b,
            0
        );

    let roll =
        Math.random() * total;

    for (
        let i = 0;
        i < list.length;
        i++
    ) {

        roll -= weights[i];

        if (roll <= 0) {
            return list[i];
        }

    }

    return list[list.length - 1];

}


// ========================================
// 순위 → 품질
// ========================================

function qualityFromRank(rankIndex) {

    if (rankIndex === 0)
        return "Best";

    if (rankIndex === 1)
        return "Great";

    if (rankIndex === 2)
        return "Best";

    if (rankIndex === 3)
        return "Excellent";

    if (rankIndex <= 5)
        return "Good";

    if (rankIndex <= 8)
        return "Inaccuracy";

    if (rankIndex <= 12)
        return "Mistake";

    return "Blunder";

}


// ========================================
// 봇 수 선택
// ========================================

export function chooseMove(
    currentBot,
    fallbackMove
) {

    const profile =
        difficulty[currentBot] ??
        difficulty.talc;

    const candidates =
        getCandidates();


    // 후보가 없을 때
    if (!candidates.length) {

        return {

            move: fallbackMove,

            quality: "Best",

            rank: 0,

            score: 0,

            mate: null

        };

    }


    const r =
        Math.random();

    const n =
        candidates.length;


    const top1 =
        candidates[0];

    const top2 =
        candidates[1] ??
        top1;

    const top3 =
        candidates[2] ??
        top1;


    const topQuarter =
        candidates.slice(
            0,
            Math.max(
                1,
                Math.ceil(n * 0.25)
            )
        );


    const topHalf =
        candidates.slice(
            0,
            Math.max(
                1,
                Math.ceil(n * 0.5)
            )
        );


    const middleThird =
        candidates.slice(
            Math.max(
                0,
                Math.floor(n * 0.33)
            ),
            Math.max(
                1,
                Math.floor(n * 0.66)
            )
        );


    const lowerThird =
        candidates.slice(
            Math.max(
                0,
                Math.floor(n * 0.66)
            ),
            n
        );


    const bottomQuarter =
        candidates.slice(
            Math.max(
                0,
                Math.floor(n * 0.75)
            )
        );


    let chosen = null;
    let quality = "Best";


    // Brilliant
    if (
        r <
        profile.brilliantChance
    ) {

        chosen = top1;

        quality = "Brilliant";

    }


    // Great
    else if (
        r <
        profile.greatChance
    ) {

        chosen = top2;

        quality = "Great";

    }


    // Best
    else if (
        r <
        profile.bestChance
    ) {

        chosen = top3;

        quality = "Best";

    }


    // Excellent
    else if (
        r <
        profile.excellentChance
    ) {

        chosen =
            pickWeightedByScore(
                topQuarter
            );

        quality =
            qualityFromRank(
                candidates.indexOf(chosen)
            );

    }


    // Good
    else if (
        r <
        profile.goodChance
    ) {

        chosen =
            pickWeightedByScore(
                topHalf
            );

        quality =
            qualityFromRank(
                candidates.indexOf(chosen)
            );

    }


    // Inaccuracy
    else if (
        r <
        profile.inaccuracyChance
    ) {

        chosen =
            pickRandom(
                middleThird.length
                    ? middleThird
                    : topHalf
            );

        quality =
            qualityFromRank(
                candidates.indexOf(chosen)
            );

    }


    // Mistake
    else if (
        r <
        profile.mistakeChance
    ) {

        chosen =
            pickRandom(
                lowerThird.length
                    ? lowerThird
                    : topHalf
            );

        quality =
            qualityFromRank(
                candidates.indexOf(chosen)
            );

    }


    // Blunder
    else if (
        r <
        profile.blunderChance
    ) {

        chosen =
            pickRandom(
                bottomQuarter.length
                    ? bottomQuarter
                    : [candidates[n - 1]]
            );

        quality = "Blunder";

    }


    // 최악의 경우
    else {

        chosen =
            candidates[n - 1];

        quality =
            "Blunder";

    }


    if (!chosen) {

        chosen = top1;

        quality = "Best";

    }


    return {

        move: chosen.move,

        quality,

        rank:
            candidates.indexOf(chosen),

        score:
            chosen.score,

        mate:
            chosen.mate

    };

}


// ========================================
// UCI move 비교
// ========================================

export function normalizeUciMove(move) {

    if (!move) {
        return "";
    }

    return move
        .trim()
        .toLowerCase()
        .replace(/[^a-h1-8qrbn]/g, "");

}


// ========================================
// 플레이어가 둔 수 찾기
// ========================================

export function findCandidateMove(
    move,
    candidates
) {

    if (
        !move ||
        !candidates ||
        !candidates.length
    ) {

        return null;

    }


    const base =
        `${move.from}${move.to}`
            .toLowerCase();


    const promotion =
        move.promotion
            ? move.promotion.toLowerCase()
            : "";


    // 승진 수
    if (promotion) {

        const exact =
            candidates.find(c =>
                normalizeUciMove(c.move) ===
                `${base}${promotion}`
            );

        if (exact) {
            return exact;
        }

    }


    // 일반 수
    return (
        candidates.find(c =>
            normalizeUciMove(c.move)
                .startsWith(base)
        ) ??
        null
    );

}


//----------------------------------------
// Mate score 변환
//----------------------------------------

export function scoreToCentipawn(score, mate) {

    if (mate === null || mate === undefined) {
        return score ?? 0;
    }

    if (mate > 0) {
        return 100000 - Math.min(mate, 1000);
    }

    return -100000 + Math.min(
        Math.abs(mate),
        1000
    );

}


//----------------------------------------
// 상대방 차례 평가를
// 플레이어 관점으로 변환
//----------------------------------------

export function normalizeOpponentScore(
    score,
    mate
) {

    const cp =
        scoreToCentipawn(
            score,
            mate
        );

    return -cp;

}


//----------------------------------------
// 실제 수 평가
//----------------------------------------

export function evaluatePlayerMove(
    beforeAnalysis,
    afterAnalysis,
    moveInfo = {}
) {

    if (!beforeAnalysis) {

        return {

            quality: "Good",

            loss: null,

            bestScore: null,

            playedScore: null,

            bestMove: null,

            isMate: false,

            isBrilliant: false

        };

    }


    //--------------------------------
    // 최선수의 평가
    //--------------------------------

    const bestScore =
        scoreToCentipawn(
            beforeAnalysis.score,
            beforeAnalysis.mate
        );


    //--------------------------------
    // 실제 수의 평가
    //
    // afterAnalysis는 상대방 차례이므로
    // 부호 반전
    //--------------------------------

    let playedScore = null;

    if (afterAnalysis) {

        playedScore =
            normalizeOpponentScore(
                afterAnalysis.score,
                afterAnalysis.mate
            );

    }


    //--------------------------------
    // 평가 손실
    //--------------------------------

    let loss = null;

    if (
        playedScore !== null
    ) {

        loss =
            Math.max(
                0,
                bestScore -
                playedScore
            );

    }


    //--------------------------------
    // 체크메이트
    //--------------------------------

    const isMate =
        !!moveInfo.san?.includes("#");


    //--------------------------------
    // 상대방이 바로 메이트 가능한지
    //--------------------------------

    const opponentMate =
        afterAnalysis?.mate;


    //--------------------------------
    // Brilliant 조건
    //--------------------------------
    //
    // 체크메이트라고 무조건 Brilliant X
    //
    //--------------------------------

    const isBrilliant =
        determineBrilliant(
            beforeAnalysis,
            afterAnalysis,
            moveInfo,
            loss
        );


    //--------------------------------
    // 품질
    //--------------------------------

    let quality;


    if (isBrilliant) {

        quality = "Brilliant";

    }

    else if (
        opponentMate !== null &&
        opponentMate !== undefined &&
        opponentMate < 0
    ) {

        // 실제 수 이후 상대가
        // 강제 메이트를 갖는 경우
        quality = "Blunder";

    }

    else if (
        loss === null
    ) {

        quality = "Good";

    }

    else if (
        loss <= 10
    ) {

        quality = "Best";

    }

    else if (
        loss <= 25
    ) {

        quality = "Great";

    }

    else if (
        loss <= 50
    ) {

        quality = "Excellent";

    }

    else if (
        loss <= 100
    ) {

        quality = "Good";

    }

    else if (
        loss <= 200
    ) {

        quality = "Inaccuracy";

    }

    else if (
        loss <= 400
    ) {

        quality = "Mistake";

    }

    else {

        quality = "Blunder";

    }


    return {

        quality,

        loss,

        bestScore,

        playedScore,

        bestMove:
            beforeAnalysis.bestMove,

        isMate,

        isBrilliant,

        depth:
            beforeAnalysis.depth,

        afterDepth:
            afterAnalysis?.depth ?? null

    };

}


//----------------------------------------
// Brilliant 판정
//----------------------------------------

function determineBrilliant(
    beforeAnalysis,
    afterAnalysis,
    moveInfo,
    loss
) {

    //--------------------------------
    // 분석 자체가 없으면 X
    //--------------------------------

    if (
        !beforeAnalysis ||
        !afterAnalysis
    ) {

        return false;

    }


    //--------------------------------
    // 평가 손실이 있으면 X
    //--------------------------------

    if (
        loss === null ||
        loss > 20
    ) {

        return false;

    }


    //--------------------------------
    // 체크메이트만으로 Brilliant X
    //--------------------------------

    const givesMate =
        moveInfo.san?.includes("#");


    //--------------------------------
    // 실제 희생인지
    //--------------------------------

    const isCapture =
        !!moveInfo.captured;


    //--------------------------------
    // 기물 가치
    //--------------------------------

    const values = {

        p: 1,

        n: 3,

        b: 3,

        r: 5,

        q: 9,

        k: 0

    };


    const movedPiece =
        values[moveInfo.piece] ?? 0;


    //--------------------------------
    // 희생 후보
    //--------------------------------

    const isSacrifice =
        movedPiece >= 3 &&
        (
            !isCapture ||
            moveInfo.captured === undefined
        );


    //--------------------------------
    // 평가가 매우 좋아졌고
    // 전술적 수인 경우
    //--------------------------------

    const tactical =
        givesMate ||
        isSacrifice ||
        !!moveInfo.captured ||
        moveInfo.san?.includes("+");


    //--------------------------------
    // 중요한 조건
    //--------------------------------

    if (
        tactical &&
        loss <= 10
    ) {

        return true;

    }


    return false;

}

// ========================================
// Accuracy 계산
// ========================================
//
// CPL = Centipawn Loss
//
// 수를 두기 전 최선의 평가와
// 실제 수를 둔 후의 평가 차이를 이용한다.
//
// loss가 작을수록 좋은 수.
// ========================================

export function calculateMoveAccuracy(
    bestScore,
    playedScore
) {

    if (
        bestScore === null ||
        bestScore === undefined ||
        playedScore === null ||
        playedScore === undefined
    ) {
        return 0;
    }


    const loss = Math.max(
        0,
        bestScore - playedScore
    );


    // 완벽한 수
    if (loss <= 0) {
        return 100;
    }


    // Stockfish centipawn loss를
    // 0~100 Accuracy로 변환
    //
    // 100cp 손실 → 약 80
    // 200cp 손실 → 약 60
    // 400cp 이상 → 매우 낮음
    //
    const accuracy =
        100 *
        Math.exp(
            -loss / 300
        );


    return Math.max(
        0,
        Math.min(
            100,
            Number(accuracy.toFixed(1))
        )
    );
}