import React from "react";

export default function StandingsPanel({ title, standings, note }) {
    return (
        <div className="standings">
            <h2>{title}</h2>
            {standings.length === 0 ? (
                <p className="standings-empty">
                    No completed games with predictions yet.
                </p>
            ) : (
                <table className="standings-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>User</th>
                            <th>Correct</th>
                            <th>Total</th>
                            <th>Win %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((s, idx) => (
                            <tr key={s.userId}>
                                <td>{idx + 1}</td>
                                <td>{s.name}</td>
                                <td>{s.correct}</td>
                                <td>{s.total}</td>
                                <td>
                                    {s.total > 0 ? (s.pct * 100).toFixed(1) + "%" : "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <p className="standings-note">
                {note || "Rankings are based on completed games only; ties are ignored."}
            </p>
        </div>
    );
}