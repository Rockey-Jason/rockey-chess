class StockfishEngine {
  constructor() {
    this.engine = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-18-lite-single.js`);
    this.ready = false;
    this.initialized = false;
    this.destroyed = false;
    this.searching = false;
    this.searchId = 0;
    this.pending = null;
    this.commandQueue = [];
    this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });

    this.engine.onmessage = event => this._handle(String(event.data ?? ""));
    this.engine.postMessage("uci");
  }

  _handle(msg) {
    if (msg === "uciok") {
      if (!this.initialized) {
        this.initialized = true;
        this.engine.postMessage("isready");
      }
      return;
    }

    if (msg === "readyok") {
      this.ready = true;
      this.resolveReady?.();
      this.resolveReady = null;
      this._flush();
      return;
    }

    const pending = this.pending;
    if (pending && pending.id === this.searchId) pending.onMessage(msg);
  }

  _flush() {
    if (!this.ready || this.destroyed) return;
    while (this.commandQueue.length) this.engine.postMessage(this.commandQueue.shift());
  }

  send(command) {
    if (!command || this.destroyed) return;
    if (!this.ready) this.commandQueue.push(command);
    else this.engine.postMessage(command);
  }

  async waitUntilReady() {
    if (!this.ready) await this.readyPromise;
  }

  async stop() {
    await this.waitUntilReady();
    if (this.searching) this.engine.postMessage("stop");
  }

  async newGame() {
    await this.waitUntilReady();
    if (this.searching) this.engine.postMessage("stop");
    this.searching = false;
    this.engine.postMessage("ucinewgame");
    this.engine.postMessage("isready");
  }

  _setSearchOptions(options = {}, multiPV = 1) {
    if (options.fullStrength) {
      this.engine.postMessage("setoption name UCI_LimitStrength value false");
      this.engine.postMessage("setoption name Skill Level value 20");
    } else {
      this.engine.postMessage(`setoption name UCI_LimitStrength value ${options.limitStrength ? "true" : "false"}`);
      if (options.skill != null) this.engine.postMessage(`setoption name Skill Level value ${options.skill}`);
      if (options.elo != null) this.engine.postMessage(`setoption name UCI_Elo value ${options.elo}`);
    }
    this.engine.postMessage(`setoption name MultiPV value ${multiPV}`);
  }

  async search(fen, depth = 18, options = {}) {
    await this.waitUntilReady();
    if (this.searching) await this.stop();

    const id = ++this.searchId;
    this.searching = true;
    this._setSearchOptions(options, 1);
    this.engine.postMessage(`position fen ${fen}`);

    return new Promise(resolve => {
      let bestMove = null;
      let latestDepth = 0;
      let finished = false;

      const finish = result => {
        if (finished) return;
        finished = true;
        if (this.pending?.id === id) this.pending = null;
        this.searching = false;
        resolve({ ...result, searchId: id });
      };

      this.pending = {
        id,
        onMessage: msg => {
          if (msg.startsWith("info")) {
            const d = Number(msg.match(/\bdepth\s+(\d+)/)?.[1] || 0);
            if (d >= latestDepth) {
              latestDepth = d;
              const pv = msg.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1];
              if (pv) bestMove = pv;
            }
          }
          if (msg.startsWith("bestmove")) {
            const move = msg.trim().split(/\s+/)[1];
            finish({ bestMove: move && move !== "(none)" ? move : bestMove, depth: latestDepth });
          }
        }
      };

      this.engine.postMessage(options.movetime
        ? `go depth ${depth} movetime ${Math.max(20, options.movetime)}`
        : `go depth ${depth}`);
    });
  }

  async analyzePosition(fen, depth = 16, options = {}) {
    await this.waitUntilReady();
    if (this.searching) await this.stop();

    const id = ++this.searchId;
    const sideToMove = String(fen).split(/\s+/)[1] === "b" ? "b" : "w";
    const multiPV = options.multiPV || 3;
    this.searching = true;
    this._setSearchOptions(options, multiPV);
    this.engine.postMessage(`position fen ${fen}`);

    return new Promise(resolve => {
      const lines = new Map();
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (this.pending?.id === id) this.pending = null;
        this.searching = false;
        const candidates = [...lines.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([, v]) => v);

        const first = candidates[0] || {};
        resolve({
          score: first.score ?? 0,
          mate: first.mate ?? null,
          bestMove: first.move || null,
          depth: first.depth || 0,
          sideToMove,
          candidates,
          searchId: id
        });
      };

      this.pending = {
        id,
        onMessage: msg => {
          if (msg.startsWith("info")) {
            const depthMatch = msg.match(/\bdepth\s+(\d+)/);
            const multiMatch = msg.match(/\bmultipv\s+(\d+)/);
            const d = Number(depthMatch?.[1] || 0);
            const pv = Number(multiMatch?.[1] || 1);
            if (!d) return;

            const mateMatch = msg.match(/\bscore\s+mate\s+(-?\d+)/);
            const cpMatch = msg.match(/\bscore\s+cp\s+(-?\d+)/);
            const pvMove = msg.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1];
            const previous = lines.get(pv);
            if (!previous || d >= previous.depth) {
              lines.set(pv, {
                move: pvMove || previous?.move || null,
                score: mateMatch ? (Number(mateMatch[1]) > 0 ? 100000 : -100000) : Number(cpMatch?.[1] ?? previous?.score ?? 0),
                mate: mateMatch ? Number(mateMatch[1]) : (cpMatch ? null : previous?.mate ?? null),
                depth: d
              });
            }
          }
          if (msg.startsWith("bestmove")) finish();
        }
      };

      this.engine.postMessage(options.movetime
        ? `go depth ${depth} movetime ${Math.max(40, options.movetime)}`
        : `go depth ${depth}`);
    });
  }

  async evaluatePosition(fen, depth = 18, options = {}) {
    return this.analyzePosition(fen, depth, options);
  }

  terminate() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.searching = false;
    this.pending = null;
    this.commandQueue = [];
    try { this.engine.terminate(); } catch {}
  }
}

export default StockfishEngine;
