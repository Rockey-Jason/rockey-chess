class StockfishEngine {

    constructor() {

        this.engine = new Worker(
            `${import.meta.env.BASE_URL}stockfish/stockfish-18-lite-single.js`
        );

        this.ready = false;

        this.initialized = false;

        this.callback = null;

        this.readyPromise =
            new Promise((resolve) => {

                this.resolveReady = resolve;

            });

        this.commandQueue = [];

        this.searching = false;

        this.destroyed = false;

        this.searchId = 0;

        this.currentSearchId = 0;


        //--------------------------------
        // Worker message
        //--------------------------------

        this.engine.onmessage = (e) => {

            const msg =
                typeof e.data === "string"
                    ? e.data
                    : String(e.data);

            console.log(
                "SF >",
                msg
            );


            //--------------------------------
            // UCI 완료
            //--------------------------------

            if (msg === "uciok") {

                if (!this.initialized) {

                    this.initialized = true;

                    this.engine.postMessage(
                        "isready"
                    );

                }

                return;
            }


            //--------------------------------
            // 준비 완료
            //--------------------------------

            if (msg === "readyok") {

                this.ready = true;

                console.log(
                    "✅ Stockfish READY"
                );


                if (this.resolveReady) {

                    this.resolveReady();

                    this.resolveReady = null;

                }


                this.flushQueue();

            }


            //--------------------------------
            // 외부 callback
            //--------------------------------

            if (this.callback) {

                this.callback(msg);

            }

        };


        //--------------------------------
        // Stockfish 초기화
        //--------------------------------

        console.log(
            "🚀 Stockfish UCI 시작"
        );

        this.engine.postMessage(
            "uci"
        );

    }


    //--------------------------------
    // Queue 처리
    //--------------------------------

    flushQueue() {

        if (!this.ready) {
            return;
        }

        while (
            this.commandQueue.length
        ) {

            const command =
                this.commandQueue.shift();

            this.engine.postMessage(
                command
            );

        }

    }


    //--------------------------------
    // 일반 명령
    //--------------------------------

    send(command) {

        if (
            this.destroyed
        ) {

            console.warn(
                "⚠️ 종료된 Stockfish에 명령:",
                command
            );

            return;

        }


        if (
            !command ||
            typeof command !== "string"
        ) {

            return;

        }


        //--------------------------------
        // UCI는 절대 외부에서 다시 보내지 않음
        //--------------------------------

        if (
            command.trim() === "uci"
        ) {

            console.warn(
                "⚠️ 외부 uci 명령 무시"
            );

            return;

        }


        //--------------------------------
        // ready 전
        //--------------------------------

        if (!this.ready) {

            this.commandQueue.push(
                command
            );

            return;

        }


        //--------------------------------
        // 전송
        //--------------------------------

        this.engine.postMessage(
            command
        );

    }


    //--------------------------------
    // callback 등록
    //--------------------------------

    onMessage(callback) {

        this.callback =
            typeof callback === "function"
                ? callback
                : null;

    }


    //--------------------------------
    // callback 제거
    //--------------------------------

    offMessage(callback) {

        if (
            !callback ||
            this.callback === callback
        ) {

            this.callback = null;

        }

    }


    //--------------------------------
    // 준비 완료 대기
    //--------------------------------

    async waitUntilReady() {

        if (this.ready) {

            return;

        }

        await this.readyPromise;

    }


    //--------------------------------
    // 검색 중단
    //--------------------------------

    async stop() {

        await this.waitUntilReady();

        if (!this.searching) {

            return;

        }

        this.engine.postMessage(
            "stop"
        );

        this.searching = false;

    }


    //--------------------------------
    // 새 게임
    //--------------------------------

    async newGame() {

        await this.waitUntilReady();

        if (this.searching) {

            this.engine.postMessage(
                "stop"
            );

            this.searching = false;

        }

        this.engine.postMessage(
            "ucinewgame"
        );

        this.engine.postMessage(
            "isready"
        );

    }


    //--------------------------------
    // 안전한 검색
    //--------------------------------

    async search(
        fen,
        depth = 18,
        options = {}
    ) {

        await this.waitUntilReady();


        //--------------------------------
        // 이전 검색 중단
        //--------------------------------

        if (this.searching) {

            console.log(
                "⏹️ 이전 검색 중단"
            );

            this.engine.postMessage(
                "stop"
            );

            this.searching = false;

        }


        //--------------------------------
        // 검색 ID
        //--------------------------------

        const searchId =
            ++this.searchId;

        this.currentSearchId =
            searchId;


        //--------------------------------
        // 옵션
        //--------------------------------

        if (
            options.skill !== undefined
        ) {

            this.engine.postMessage(
                `setoption name Skill Level value ${options.skill}`
            );

        }


        if (
            options.limitStrength !== undefined
        ) {

            this.engine.postMessage(
                `setoption name UCI_LimitStrength value ${options.limitStrength ? "true" : "false"}`
            );

        }


        if (
            options.elo !== undefined
        ) {

            this.engine.postMessage(
                `setoption name UCI_Elo value ${options.elo}`
            );

        }


        this.engine.postMessage(
            "setoption name MultiPV value 1"
        );


        //--------------------------------
        // 반드시 position 먼저
        //--------------------------------

        this.engine.postMessage(
            `position fen ${fen}`
        );


        //--------------------------------
        // 검색
        //--------------------------------

        this.searching = true;


        console.log(
            "🔎 Stockfish SEARCH",
            {
                searchId,
                depth,
                fen
            }
        );


        return new Promise((resolve) => {

            let finished = false;

            const handler = (msg) => {

                if (finished) {
                    return;
                }


                //--------------------------------
                // 다른 검색이면 무시
                //--------------------------------

                if (
                    searchId !==
                    this.currentSearchId
                ) {

                    return;

                }


                //--------------------------------
                // bestmove
                //--------------------------------

                if (
                    msg.startsWith(
                        "bestmove"
                    )
                ) {

                    finished = true;

                    this.searching = false;


                    const parts =
                        msg
                            .trim()
                            .split(/\s+/);


                    const bestMove =
                        parts[1] || null;


                    console.log(
                        "🎯 Stockfish BESTMOVE",
                        {
                            searchId,
                            bestMove
                        }
                    );


                    resolve({

                        bestMove,

                        searchId

                    });

                }

            };


            //--------------------------------
            // 기존 callback과 별도로
            //--------------------------------

            const oldCallback =
                this.callback;


            this.callback = (msg) => {

                if (oldCallback) {

                    oldCallback(msg);

                }

                handler(msg);

            };


            //--------------------------------
            // 실제 검색
            //--------------------------------

            this.engine.postMessage(
                `go depth ${depth}`
            );

        });

    }


    //--------------------------------
    // 포지션 분석
    //--------------------------------

    async analyzePosition(
        fen,
        depth = 18
    ) {

        await this.waitUntilReady();


        //--------------------------------
        // 이전 검색 중단
        //--------------------------------

        if (this.searching) {

            this.engine.postMessage(
                "stop"
            );

            this.searching = false;

        }


        const searchId =
            ++this.searchId;

        this.currentSearchId =
            searchId;


        return new Promise((resolve) => {

            let latestScore = 0;

            let latestMate = null;

            let latestDepth = 0;

            let latestBestMove = null;

            let finished = false;


            const oldCallback =
                this.callback;


            const handler = (msg) => {

                if (finished) {
                    return;
                }


                //--------------------------------
                // 다른 검색 결과 무시
                //--------------------------------

                if (
                    searchId !==
                    this.currentSearchId
                ) {

                    return;

                }


                //--------------------------------
                // info
                //--------------------------------

                if (
                    msg.startsWith(
                        "info"
                    )
                ) {

                    const depthMatch =
                        msg.match(
                            /\bdepth\s+(\d+)/
                        );


                    if (!depthMatch) {
                        return;
                    }


                    const infoDepth =
                        Number(
                            depthMatch[1]
                        );


                    if (
                        infoDepth <
                        latestDepth
                    ) {

                        return;

                    }


                    latestDepth =
                        infoDepth;


                    //--------------------------------
                    // centipawn
                    //--------------------------------

                    const scoreMatch =
                        msg.match(
                            /\bscore\s+cp\s+(-?\d+)/
                        );


                    if (scoreMatch) {

                        latestScore =
                            Number(
                                scoreMatch[1]
                            );

                        latestMate = null;

                    }


                    //--------------------------------
                    // mate
                    //--------------------------------

                    const mateMatch =
                        msg.match(
                            /\bscore\s+mate\s+(-?\d+)/
                        );


                    if (mateMatch) {

                        latestMate =
                            Number(
                                mateMatch[1]
                            );

                        latestScore =
                            latestMate > 0
                                ? 100000
                                : -100000;

                    }


                    //--------------------------------
                    // PV 첫 수
                    //--------------------------------

                    const pvMatch =
                        msg.match(
                            /\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/
                        );


                    if (pvMatch) {

                        latestBestMove =
                            pvMatch[1];

                    }

                }


                //--------------------------------
                // bestmove
                //--------------------------------

                if (
                    msg.startsWith(
                        "bestmove"
                    )
                ) {

                    finished = true;

                    this.searching = false;


                    const bestMove =
                        msg
                            .trim()
                            .split(/\s+/)[1];


                    if (
                        bestMove &&
                        bestMove !== "(none)"
                    ) {

                        latestBestMove =
                            bestMove;

                    }


                    this.callback =
                        oldCallback;


                    const sideToMove =
                        String(fen || "").split(/\s+/)[1] === "b"
                            ? "b"
                            : "w";

                    resolve({

                        score:
                            latestScore,

                        mate:
                            latestMate,

                        bestMove:
                            latestBestMove,

                        depth:
                            latestDepth,

                        sideToMove,

                        searchId

                    });

                }

            };


            this.callback = (msg) => {

                if (oldCallback) {

                    oldCallback(msg);

                }

                handler(msg);

            };


            //--------------------------------
            // position
            //--------------------------------

            this.engine.postMessage(
                `position fen ${fen}`
            );


            //--------------------------------
            // search
            //--------------------------------

            this.searching = true;


            this.engine.postMessage(
                `go depth ${depth}`
            );

        });

    }


    //--------------------------------
    // 평가용 별칭
    //--------------------------------

    async evaluatePosition(
        fen,
        depth = 18
    ) {

        return this.analyzePosition(
            fen,
            depth
        );

    }


    //--------------------------------
    // 종료
    //--------------------------------

    terminate() {

        if (this.destroyed) {
            return;
        }


        this.destroyed = true;

        this.searching = false;

        this.commandQueue = [];


        try {

            this.engine.terminate();

        }
        catch (error) {

            console.error(
                "Stockfish terminate error:",
                error
            );

        }

    }

}

export default StockfishEngine;