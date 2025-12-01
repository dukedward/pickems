// src/components/UserSettingsPage.jsx
import React, { useEffect, useState } from "react";
import Avatar from "./Avatar";
import {
    storage,
    storageRef,
    uploadBytes,
    getDownloadURL,
} from "../firebase";

function UserSettingsPage({ open, onClose, player, onSave }) {
    const [name, setName] = useState("");
    const [nickname, setNickname] = useState("");
    const [color, setColor] = useState("#38bdf8");
    const [profileImageUrl, setProfileImageUrl] = useState(null);
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!player) return;
        setName(player.name || "");
        setNickname(player.nickname || "");
        setColor(player.color || "#38bdf8");
        setProfileImageUrl(player.profileImageUrl || null);
        setFile(null);
        setError("");
    }, [player, open]);

    if (!open || !player) return null;

    const displayName = nickname || name || "Player";

    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
    };

    const handleUploadPhoto = async () => {
        if (!file || !player) return;
        setBusy(true);
        setError("");

        try {
            const ref = storageRef(storage, `profilePictures/${player.id}`);
            await uploadBytes(ref, file);
            const url = await getDownloadURL(ref);
            setProfileImageUrl(url);
            await onSave({ profileImageUrl: url });
            setFile(null);
        } catch (e) {
            console.error("Upload failed", e);
            setError("Failed to upload profile picture.");
        } finally {
            setBusy(false);
        }
    };

    const handleRemovePhoto = async () => {
        try {
            setBusy(true);
            setError("");
            setProfileImageUrl(null);
            await onSave({ profileImageUrl: null });
        } catch (e) {
            console.error("Remove photo failed", e);
            setError("Failed to remove profile picture.");
        } finally {
            setBusy(false);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!player) return;
        setBusy(true);
        setError("");
        try {
            const cleanName = name.trim() || player.name || "Player";
            const initials = cleanName[0].toUpperCase();

            await onSave({
                name: cleanName,
                nickname: nickname.trim() || null,
                color,
                initials,
            });
        } catch (e) {
            console.error("Save profile failed", e);
            setError("Failed to save profile.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="user-settings-backdrop" onClick={onClose}>
            <div
                className="user-settings"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="user-settings-header">
                    <h2>Profile Settings</h2>
                    <button
                        className="modal-close"
                        type="button"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                <div className="user-settings-body">
                    <div className="user-settings-left">
                        <div className="user-avatar-block">
                            <Avatar
                                initials={player.initials}
                                color={color}
                                imageUrl={profileImageUrl}
                                size={72}
                                alt={displayName}
                            />
                            <p className="user-settings-displayname">{displayName}</p>

                            <label className="file-input-label small">
                                Choose profile picture
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={busy}
                                    style={{ display: "none" }}
                                />
                            </label>

                            {file && (
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleUploadPhoto}
                                    disabled={busy}
                                >
                                    {busy ? "Uploading…" : "Upload photo"}
                                </button>
                            )}

                            {profileImageUrl && !file && (
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={handleRemovePhoto}
                                    disabled={busy}
                                >
                                    Remove photo
                                </button>
                            )}

                            <p className="user-settings-hint">
                                If no photo is set, your colored avatar will be used.
                            </p>
                        </div>
                    </div>

                    <div className="user-settings-right">
                        <form onSubmit={handleSaveProfile} className="user-settings-form">
                            <label className="login-label">
                                Name
                                <input
                                    type="text"
                                    className="login-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={busy}
                                />
                            </label>

                            <label className="login-label">
                                Nickname (optional)
                                <input
                                    type="text"
                                    className="login-input"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    disabled={busy}
                                />
                            </label>

                            <label className="login-label">
                                Avatar color
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    disabled={busy}
                                    style={{ width: 64, height: 32, border: "none" }}
                                />
                            </label>

                            {error && (
                                <div className="login-error" style={{ marginTop: "0.4rem" }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={busy}
                            >
                                {busy ? "Saving…" : "Save profile"}
                            </button>
                        </form>

                        <p className="user-settings-hint">
                            Your nickname (if set) will be shown instead of your name
                            on leaderboards and picks.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UserSettingsPage;