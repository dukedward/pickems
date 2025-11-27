import React from "react";
import TeamRow from "./TeamRow";

export default function GameCard({
    game,
    users,
    predictions,
    onPredictionChange,
}) {
    const kickoff = new Date(game.date);

    return (
        <div className="game-card">
            <div className="game-header">
                <div className="game-time">
                    {kickoff.toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                    })}
                </div>
                <div className="game-status">{game.statusText}</div>
            </div>

            <div className="teams">
                <TeamRow team={game.away} label="Away" />
                <TeamRow team={game.home} label="Home" />
            </div>

            <div className="predictions">
                {users.map((user) => (
                    <div key={user.id} className="prediction-row">
                        <span className="prediction-user">{user.name}</span>
                        <select
                            value={predictions[user.id] || ""}
                            onChange={(e) =>
                                onPredictionChange(game.id, user.id, e.target.value)
                            }
                        >
                            <option value="">– Pick winner –</option>
                            <option value={game.away.id}>
                                {game.away.abbrev} ({game.away.name})
                            </option>
                            <option value={game.home.id}>
                                {game.home.abbrev} ({game.home.name})
                            </option>
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
}