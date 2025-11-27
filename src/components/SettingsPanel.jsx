import React from "react";
import Avatar from "./Avatar";

export default function SettingsPanel({ users, onUpdateUser }) {
    return (
        <div className="settings-panel">
            <h2>Players</h2>
            {users.map((user) => (
                <div className="settings-row" key={user.id}>
                    <Avatar initials={user.initials} color={user.color} size={32} />
                    <input
                        className="settings-name-input"
                        value={user.name}
                        onChange={(e) =>
                            onUpdateUser(user.id, { name: e.target.value })
                        }
                    />
                </div>
            ))}
        </div>
    );
}