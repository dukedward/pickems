// src/components/SettingsPanel.jsx
import React from "react";
import Avatar from "./Avatar";

export default function SettingsPanel({
    players,
    currentPlayerId,
    isAdmin,
    onUpdatePlayer,
}) {
    return (
        <div className="settings-panel">
            <h2>Players</h2>
            {players.map((player) => {
                const canEdit = isAdmin || player.id === currentPlayerId;
                const displayName = player.displayName || player.name;

                return (
                    <div className="settings-row" key={player.id}>
                        <Avatar
                            initials={player.initials}
                            color={player.color}
                            imageUrl={player.profileImageUrl}
                            size={32}
                            alt={displayName}
                        />
                        <input
                            className="settings-name-input"
                            value={displayName}
                            onChange={(e) =>
                                canEdit &&
                                onUpdatePlayer(player.id, { name: e.target.value })
                            }
                            disabled={!canEdit}
                        />
                        <input
                            type="color"
                            value={player.color}
                            onChange={(e) =>
                                canEdit &&
                                onUpdatePlayer(player.id, { color: e.target.value })
                            }
                            disabled={!canEdit}
                            style={{ width: 32, height: 24, border: "none" }}
                        />
                    </div>
                );
            })}
            <p className="settings-note">
                Use the Settings page for full profile (nickname & photo).
            </p>
        </div>
    );
}