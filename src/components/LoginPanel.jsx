// src/components/LoginPanel.jsx
import React, { useState } from "react";
import {
    auth,
    provider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithRedirect,
} from "../firebase";

function LoginPanel({ onError, onSuccess }) {
    const [mode, setMode] = useState("login"); // 'login' | 'signup'
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [localError, setLocalError] = useState("");

    const handleError = (msg, rawError) => {
        console.error(msg, rawError);
        setLocalError(msg);
        if (onError) onError(msg);
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setLocalError("");
        try {
            if (!email || !password) {
                throw new Error("Email and password are required.");
            }

            if (mode === "login") {
                await signInWithEmailAndPassword(auth, email, password);
                if (onSuccess) onSuccess("Logged in successfully.");
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                if (onSuccess) onSuccess("Account created and logged in.");
            }
        } catch (err) {
            const generic =
                mode === "login"
                    ? "Failed to sign in with email/password."
                    : "Failed to sign up with email/password.";
            handleError(generic, err);
        } finally {
            setBusy(false);
        }
    };

    const handleGoogle = async () => {
        setBusy(true);
        setLocalError("");
        try {
            // First try popup (works great on desktop)
            await signInWithPopup(auth, provider);
            if (onSuccess) onSuccess("Signed in with Google.");
        } catch (err) {
            console.warn("Google popup sign-in failed, trying redirect.", err);

            // Codes that usually mean popup is blocked / not supported
            const code = err?.code || "";
            const popupBlocked =
                code === "auth/popup-blocked" ||
                code === "auth/popup-closed-by-user" ||
                code === "auth/operation-not-supported-in-this-environment";

            if (popupBlocked) {
                try {
                    // Redirect flow works better on mobile/iOS
                    await signInWithRedirect(auth, provider);
                    // No onSuccess here – result will be handled after redirect
                } catch (redirectErr) {
                    handleError("Failed to sign in with Google (redirect).", redirectErr);
                }
            } else {
                handleError("Failed to sign in with Google.", err);
            }
        } finally {
            // Note: in redirect flow, this state will be reset on the new load anyway
            setBusy(false);
        }
    };

    return (
        <div className="login-panel">
            <h2>Sign in to make picks</h2>
            <p className="login-subtitle">
                View picks without signing in – log in to set your own.
            </p>

            <button
                type="button"
                className="btn btn-google"
                onClick={handleGoogle}
                disabled={busy}
            >
                {busy ? "Working…" : "Continue with Google"}
            </button>

            <div className="login-divider">
                <span>or</span>
            </div>

            <form onSubmit={handleEmailSubmit} className="login-form">
                <label className="login-label">
                    Email
                    <input
                        type="email"
                        className="login-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={busy}
                    />
                </label>

                <label className="login-label">
                    Password
                    <input
                        type="password"
                        className="login-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                    />
                </label>

                {localError && <div className="login-error">{localError}</div>}

                <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy
                        ? "Working…"
                        : mode === "login"
                            ? "Sign in with email"
                            : "Sign up with email"}
                </button>
            </form>

            <div className="login-mode-toggle">
                {mode === "login" ? (
                    <>
                        Don&apos;t have an account?{" "}
                        <button
                            type="button"
                            onClick={() => setMode("signup")}
                            disabled={busy}
                        >
                            Sign up
                        </button>
                    </>
                ) : (
                    <>
                        Already have an account?{" "}
                        <button
                            type="button"
                            onClick={() => setMode("login")}
                            disabled={busy}
                        >
                            Sign in
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default LoginPanel;