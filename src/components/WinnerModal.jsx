import React from "react";
import Avatar from "./Avatar.jsx"

// === Winner modal with trophy ===
function WinnerModal({ open, onClose, standing }) {
    if (!open || !standing || standing.total === 0) return null;
    const winPct = (standing.pct * 100).toFixed(1);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => {
                    e.stopPropagation();
                }}
            >
                <div className="modal-header">
                    <span className="modal-title">Weekly Winner</span>
                    <button className="modal-close" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-body">
                    <div className="winner-trophy">🏆</div>
                    <Avatar
                        initials={standing.initials}
                        color={standing.color}
                        size={56}
                    />
                    <h3 className="winner-name">{standing.nickname}</h3>
                    <p className="winner-stats">
                        {standing.correct} / {standing.total} correct ({winPct}%)
                    </p>
                </div>
            </div>
        </div>
    );
}

export default WinnerModal;