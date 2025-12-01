// src/components/Avatar.jsx
import React from "react";

export default function Avatar({
    initials,
    color,
    size = 32,
    imageUrl,
    alt,
}) {
    const baseStyle = {
        width: size,
        height: size,
        borderRadius: "999px",
        flexShrink: 0,
    };

    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={alt || "Profile"}
                style={{
                    ...baseStyle,
                    objectFit: "cover",
                    border: "2px solid rgba(148,163,184,0.7)",
                }}
            />
        );
    }

    return (
        <div
            style={{
                ...baseStyle,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: size * 0.5,
                background: color || "#4b5563",
                color: "#0b1020",
            }}
        >
            {initials}
        </div>
    );
}