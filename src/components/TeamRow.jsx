import React from "react";

export default function TeamRow({ team, label }) {
    return (
        <div className="team-row">
            <div className="team-info">
                <span className="team-label">{label}</span>
                <span className="team-name">
                    {team.abbrev} · {team.name}
                </span>
            </div>
            <div className="team-score">{team.score}</div>
        </div>
    );
}