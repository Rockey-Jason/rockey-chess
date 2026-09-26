import botData from "../data/botData";
import "./BotSelect.css";

export default function BotSelect({ chess }) {

    const {
        currentBot,
        setBot,
        rating
    } = chess;

    return (

        <div className="botSelect">

            {Object.entries(botData).map(([id, bot]) => {

                const locked = rating < bot.needRating;

                return (

                    <button

                        key={id}

                        className={`botCard ${
                            currentBot===id ? "selected" : ""
                        }`}

                        disabled={locked}

                        onClick={()=>setBot(id)}

                    >

                        <img

                            src={bot.image}

                            alt={bot.name}

                        />

                        <div className="botName">

                            {bot.name}

                        </div>

                        <div>

                            Lv.{bot.level}

                        </div>

                        <div>

                            필요 레이팅 : {bot.needRating}

                        </div>

                        {

                            locked &&

                            <div className="locked">

                                🔒

                            </div>

                        }

                    </button>

                );

            })}

        </div>

    );

}