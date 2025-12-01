// src/components/GameCard.jsx
import React from "react";
import TeamRow from "./TeamRow";

function GameCard({
    game,
    players,
    picks,
    currentPlayerId,
    isAdmin,
    onPickChange,
}) {
    const kickoff = new Date(game.date);

    const handleChange = (playerId, value) => {
        onPickChange(game.id, playerId, value);
    };

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
                {players.map((player) => {
                    const pickTeamId = picks[player.id] || "";
                    const isSelfRow = currentPlayerId === player.id;
                    const alreadyPicked = Boolean(pickTeamId);
                    const canEdit = isAdmin || (isSelfRow && !alreadyPicked);
                    const displayName = player.displayName || player.name;

                    return (
                        <div key={player.id} className="prediction-row">
                            <span className="prediction-user">
                                {displayName}
                                {player.role === "admin" && (
                                    <span className="badge badge-sm">Admin</span>
                                )}
                            </span>

                            <select
                                value={pickTeamId}
                                onChange={(e) =>
                                    handleChange(player.id, e.target.value)
                                }
                                disabled={!canEdit}
                            >
                                <option value="">
                                    {alreadyPicked && !isAdmin && isSelfRow
                                        ? "Pick locked"
                                        : "– Pick winner –"}
                                </option>
                                <option value={game.away.id}>
                                    {game.away.abbrev} ({game.away.name})
                                </option>
                                <option value={game.home.id}>
                                    {game.home.abbrev} ({game.home.name})
                                </option>
                            </select>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default GameCard;