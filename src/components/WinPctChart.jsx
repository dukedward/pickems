// src/components/WinPctChart.jsx
import React from "react";
import Avatar from "./Avatar";

export default function WinPctChart({ title, standings }) {
    if (!standings || standings.length === 0) return null;

    return (
        <div className="winpct-chart">
            <h3>{title}</h3>
            <div className="winpct-bars">
                {standings.map((s) => (
                    <div key={s.id} className="winpct-row">
                        <div className="winpct-label">
                            <Avatar
                                initials={s.initials}
                                color={s.color}
                                imageUrl={s.profileImageUrl}
                                size={24}
                                alt={s.displayName}
                            />
                            <span>{s.displayName}</span>
                        </div>
                        <div className="winpct-bar-track">
                            <div
                                className="winpct-bar-fill"
                                style={{ width: `${(s.pct || 0) * 100}%` }}
                            />
                        </div>
                        <div className="winpct-value">
                            {s.total > 0 ? (s.pct * 100).toFixed(1) + "%" : "—"}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}