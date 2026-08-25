import difficulty from "./difficulty";

export async function requestMove(
    engine,
    currentBot,
    fen
) {

    const bot =
        difficulty[currentBot]
        ?? difficulty.talc;

    console.log(
        "🤖 BOT REQUEST",
        {
            bot: currentBot,
            fen
        }
    );

    return engine.search(
        fen,
        bot.depth,
        {
            skill: bot.skill,
            elo: bot.elo,
            limitStrength: true
        }
    );

}