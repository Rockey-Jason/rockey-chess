import { afterEach, describe, expect, it, vi } from "vitest";
import StockfishEngine from "./StockfishEngine";

let workerInstance;

class FakeWorker {
  constructor() {
    this.messages = [];
    workerInstance = this;
  }

  postMessage(message) {
    this.messages.push(message);
    if (message === "uci") {
      queueMicrotask(() => this.onmessage?.({ data: "uciok" }));
    } else if (message === "isready") {
      queueMicrotask(() => this.onmessage?.({ data: "readyok" }));
    } else if (message === "stop") {
      queueMicrotask(() => this.onmessage?.({ data: "bestmove e2e4" }));
    }
  }

  terminate() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  workerInstance = null;
});

describe("StockfishEngine search lifecycle", () => {
  it("waits for the stopped search's bestmove before resolving stop", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const engine = new StockfishEngine();
    await engine.waitUntilReady();

    const searchPromise = engine.search("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 16);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.searching).toBe(true);

    await Promise.all([engine.stop(), engine.stop()]);
    const result = await searchPromise;

    expect(result.bestMove).toBe("e2e4");
    expect(engine.searching).toBe(false);
    expect(workerInstance.messages.filter(message => message === "stop")).toHaveLength(1);
    engine.terminate();
  });

  it("does not send a stop command when no search is active", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const engine = new StockfishEngine();
    await engine.waitUntilReady();
    await engine.stop();
    expect(workerInstance.messages).not.toContain("stop");
    engine.terminate();
  });
});
