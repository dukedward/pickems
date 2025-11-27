import React from "react";

export default function Avatar({ initials, color, size = 32 }) {
    const style = {
        width: size,
        height: size,
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: size * 0.5,
        background: color || "#4b5563",
        color: "#0b1020",
        flexShrink: 0,
    };

    return <div style={style}>{initials}</div>;
}