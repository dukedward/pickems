import React from "react";
import Avatar from "./Avatar";

// Weekly winner trophy modal
function WinnerModal({ open, onClose, standing, players = [] }) {
    if (!open || !standing || standing.total === 0) return null;

    // Find the matching player to get avatar / color / photo
    const player =
        (players || []).find((p) => p.id === standing.id) || {};

    const displayName =
        player.displayName || player.name || standing.displayName || "Player";

    const initials =
        player.initials ||
        (displayName ? displayName[0].toUpperCase() : "?");

    const color = player.color;
    const imageUrl = player.profileImageUrl;

    const winPct = ((standing.pct || 0) * 100).toFixed(1);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => {
                    e.stopPropagation();
                }}
            >
                <div className="modal-header">
                    <h3 className="modal-title">Weekly Winner</h3>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                <div className="modal-body">
                    <div className="winner-trophy">🏆</div>
                    <Avatar
                        initials={initials}
                        color={color}
                        imageUrl={imageUrl}
                        size={56}
                        alt={displayName}
                    />
                    <h3 className="winner-name">{displayName}</h3>
                    <p className="winner-stats">
                        {standing.correct} / {standing.total} correct ({winPct}%)
                    </p>
                </div>
            </div>
        </div>
    );
}

export default WinnerModal;