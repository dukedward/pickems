// src/util/Toast.jsx
import React from "react";

function Toast({ toast, onClose }) {
    if (!toast) return null;
    const isError = toast.type === "error";

    return (
        <div className="toast-container">
            <div className={`toast ${isError ? "toast-error" : "toast-success"}`}>
                <span className="toast-message">{toast.message}</span>
                <button className="toast-close" onClick={onClose}>
                    ✕
                </button>
            </div>
        </div>
    );
}

export default Toast;