// src/components/StandingsPanel.jsx
import React from "react";

function StandingsPanel({ title, standings, note }) {
    return (
        <div className="standings">
            <h2>{title}</h2>

            {standings.length === 0 ? (
                <p className="standings-empty">
                    No completed games with picks yet.
                </p>
            ) : (
                // ✅ Wrap table so it can scroll on mobile
                <div className="standings-table-wrapper">
                    <table className="standings-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Correct</th>
                                <th>Total</th>
                                <th>Win %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((s, idx) => (
                                <tr key={s.id}>
                                    <td>{idx + 1}</td>
                                    <td>{s.displayName}</td>
                                    <td>{s.correct}</td>
                                    <td>{s.total}</td>
                                    <td>
                                        {s.total > 0
                                            ? (s.pct * 100).toFixed(1) + "%"
                                            : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="standings-note">
                {note ||
                    "Rankings are based on completed games with picks; ties are ignored."}
            </p>
        </div>
    );
}

export default StandingsPanel;