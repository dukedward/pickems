// src/components/WinPctChart.jsx
import React from "react";
import Avatar from "./Avatar";

export default function WinPctChart({ title, standings, players = [] }) {
    if (!standings || standings.length === 0) return null;

    // Use max pct so all bars are relative
    const maxPct = Math.max(...standings.map((s) => s.pct || 0), 0.0001);

    const findPlayer = (row) =>
        (players || []).find((p) => p.id === row.id) || {};

    return (
        <div className="winpct-chart">
            <h3>{title}</h3>
            <div className="winpct-bars">
                {standings.map((s) => {
                    const player = findPlayer(s);

                    const displayName =
                        player.displayName || player.name || s.displayName || "Player";

                    const initials =
                        player.initials ||
                        (displayName ? displayName[0].toUpperCase() : "?");

                    const color = player.color;
                    const imageUrl = player.profileImageUrl;

                    const pct = s.pct || 0;
                    const widthPct = (pct / maxPct) * 100;

                    return (
                        <div key={s.id} className="winpct-row">
                            <div className="winpct-label">
                                <Avatar
                                    initials={initials}
                                    color={color}
                                    imageUrl={imageUrl}
                                    size={28}
                                    alt={displayName}
                                />
                                <span className="winpct-name">{displayName}</span>
                            </div>
                            <div className="winpct-bar-track">
                                <div
                                    className="winpct-bar-fill"
                                    style={{ width: `${widthPct}%` }}
                                />
                            </div>
                            <div className="winpct-value">
                                {s.total > 0 ? (pct * 100).toFixed(1) + "%" : "—"}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}