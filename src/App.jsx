// src/App.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import "./App.css";

import GameCard from "./components/GameCard";
import StandingsPanel from "./components/StandingsPanel";
import SettingsPanel from "./components/SettingsPanel";
import WinPctChart from "./components/WinPctChart";
import WinnerModal from "./components/WinnerModal";
import LoginPanel from "./components/LoginPanel";
import UserSettingsPage from "./components/UserSettingsPage";
import MyStatsPage from "./components/MyStatsPage";
import Toast from "./util/Toast";

import {
    db,
    auth,
    collection,
    doc,
    onSnapshot,
    setDoc,
    getDoc,
    onAuthStateChanged,
    signOut,
} from "./firebase";

const CURRENT_YEAR = new Date().getFullYear();
const BASE_URL =
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

// Set this to your admin login email
const ADMIN_EMAIL = "edward.c.gregoryiii@gmail.com";

function App() {
    const [week, setWeek] = useState(1);
    const [games, setGames] = useState([]);
    const [allGames, setAllGames] = useState({}); // { [gameId]: game }
    const [picks, setPicks] = useState({}); // { [gameId]: { [playerId]: teamId } }
    const [players, setPlayers] = useState([]); // [{ id, name, role, initials, color }]
    const [authUser, setAuthUser] = useState(null);
    const [showMyStats, setShowMyStats] = useState(false);

    const [loadingGames, setLoadingGames] = useState(false);
    const [error, setError] = useState("");
    const [hideUnpickedGames, setHideUnpickedGames] = useState(false);

    const [winnerModalOpen, setWinnerModalOpen] = useState(false);
    const [showUserSettings, setShowUserSettings] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

    // Auto-dismiss toast after 4s
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    // ==== Auth ====

    const currentPlayer = useMemo(
        () => players.find((p) => p.id === authUser?.uid) || null,
        [players, authUser]
    );
    const isAdmin = currentPlayer?.role === "admin";

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            setAuthUser(user || null);
            if (!user) return;

            const role = user.email === ADMIN_EMAIL ? "admin" : "player";
            const name = user.displayName || user.email || "Player";
            const initials = name.trim()[0]?.toUpperCase() || "P";

            const playerRef = doc(db, "players", user.uid);
            const snap = await getDoc(playerRef);

            if (!snap.exists()) {
                // 🟢 First time we see this user: create with default color
                await setDoc(playerRef, {
                    name,
                    role,
                    initials,
                    color: "#22c55e",
                });
            } else {
                // 🟢 Player already exists: update only name/role/initials
                await setDoc(
                    playerRef,
                    {
                        name,
                        role,
                        initials,
                    },
                    { merge: true }
                );
            }
        });

        return unsub;
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (e) {
            console.error("Logout failed", e);
            setToast({
                type: "error",
                message: "Logout failed. Check console for details.",
            });
        }
    };

    // ==== Firestore subscriptions "#38bdf8" ====

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "players"), (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const rawName = data.name || "Player";
                const nickname = data.nickname || "";
                const displayName = nickname || rawName;
                const initials =
                    data.initials || rawName.trim()[0]?.toUpperCase() || "P";

                list.push({
                    id: docSnap.id,
                    name: rawName,
                    nickname,
                    displayName,
                    role: data.role || "player",
                    initials,
                    color: data.color || "#38bdf8",
                    profileImageUrl: data.profileImageUrl || null,
                });
            });
            setPlayers(list);
        });
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "picks"), (snapshot) => {
            const next = {};
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                next[docSnap.id] = data.predictions || {};
            });
            setPicks(next);
        });
        return unsub;
    }, []);

    // ==== ESPN API ====
    useEffect(() => {
        // On initial load, try to detect the current NFL week
        const detectCurrentWeek = async () => {
            try {
                const url = `${BASE_URL}?year=${CURRENT_YEAR}&seasontype=2`;
                const res = await fetch(url);
                if (!res.ok) return;

                const data = await res.json();

                // ESPN usually has something like data.week.number
                const maybeWeek =
                    data.week?.number ??
                    data.week?.current ??
                    data.week ??
                    null;

                const weekNum = Number(maybeWeek);
                if (
                    Number.isFinite(weekNum) &&
                    weekNum >= 1 &&
                    weekNum <= 18
                ) {
                    setWeek(weekNum);
                }
            } catch (err) {
                console.error("Failed to detect current NFL week", err);
                // Fallback: keep week at default (1)
            }
        };

        detectCurrentWeek();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchGames(week);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [week]);

    const parseScoreboardGame = (event, weekNumber) => {
        const competition = event.competitions?.[0] || {};
        const competitors = competition.competitors || [];

        const home = competitors.find((c) => c.homeAway === "home") || {};
        const away = competitors.find((c) => c.homeAway === "away") || {};

        const homeTeam = home.team || {};
        const awayTeam = away.team || {};

        return {
            id: event.id,
            week: weekNumber,
            date: event.date,
            statusText:
                event.status?.type?.shortDetail ||
                event.status?.type?.description ||
                "TBD",
            completed: Boolean(event.status?.type?.completed),
            home: {
                id: homeTeam.id,
                name: homeTeam.displayName,
                abbrev: homeTeam.abbreviation,
                score: home.score ?? "",
            },
            away: {
                id: awayTeam.id,
                name: awayTeam.displayName,
                abbrev: awayTeam.abbreviation,
                score: away.score ?? "",
            },
        };
    };

    const fetchGames = async (weekNumber) => {
        setLoadingGames(true);
        setError("");
        try {
            const url = `${BASE_URL}?year=${CURRENT_YEAR}&seasontype=2&week=${weekNumber}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            const events = data.events || [];

            const parsed = events.map((e) => parseScoreboardGame(e, weekNumber));
            setGames(parsed);

            setAllGames((prev) => {
                const updated = { ...prev };
                parsed.forEach((g) => {
                    updated[g.id] = g;
                });
                return updated;
            });
        } catch (e) {
            console.error(e);
            setError("Failed to load games from ESPN.");
        } finally {
            setLoadingGames(false);
        }
    };

    // Helper: fetch multiple weeks (for Excel import all weeks)
    const fetchGamesForWeeksFromAPI = async (weekNumbers) => {
        if (!weekNumbers || weekNumbers.length === 0) return;
        try {
            setLoadingGames(true);
            setError("");
            const uniqueWeeks = Array.from(new Set(weekNumbers)).filter(
                (w) => w >= 1 && w <= 18
            );
            const responses = await Promise.all(
                uniqueWeeks.map((w) =>
                    fetch(`${BASE_URL}?year=${CURRENT_YEAR}&seasontype=2&week=${w}`)
                )
            );

            const allParsed = [];

            for (let i = 0; i < responses.length; i++) {
                const res = responses[i];
                const w = uniqueWeeks[i];
                if (!res.ok) continue;
                const data = await res.json();
                const events = data.events || [];
                const parsed = events.map((e) => parseScoreboardGame(e, w));
                allParsed.push(...parsed);
            }

            if (allParsed.length > 0) {
                setAllGames((prev) => {
                    const updated = { ...prev };
                    allParsed.forEach((g) => {
                        updated[g.id] = g;
                    });
                    return updated;
                });
            }
        } catch (err) {
            console.error("Error fetching games for imported weeks", err);
            setError("Some weeks could not be loaded from ESPN during import.");
            setToast({
                type: "error",
                message:
                    "Imported picks, but some weeks could not be loaded from ESPN.",
            });
        } finally {
            setLoadingGames(false);
        }
    };

    // Preload all regular-season weeks into allGames
    useEffect(() => {
        const allSeasonWeeks = Array.from({ length: 18 }, (_, i) => i + 1);
        fetchGamesForWeeksFromAPI(allSeasonWeeks);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ==== Player updates (settings) ====

    const handleUpdatePlayer = async (playerId, changes) => {
        if (!authUser) return;
        const isSelf = authUser.uid === playerId;
        if (!isAdmin && !isSelf) return;

        const clean = { ...changes };
        if (typeof clean.name === "string") {
            const name = clean.name.trim();
            clean.name = name;
            if (name) {
                clean.initials = name[0].toUpperCase();
            }
        }

        try {
            await setDoc(doc(db, "players", playerId), clean, { merge: true });
        } catch (e) {
            console.error("Failed to update player", e);
            setToast({
                type: "error",
                message: "Failed to update player. Check console for details.",
            });
        }
    };

    // ==== Picks permissions + saving ====

    /**
     * Admin:
     *   - can change any player's pick any time
     * Player:
     *   - can only set their own pick
     *   - cannot change their pick once set (only admin can override)
     * Anonymous:
     *   - view only
     */
    const handlePickChange = async (gameId, playerId, teamId) => {
        if (!authUser || !currentPlayer) return;

        const existingForGame = picks[gameId] || {};
        const existingPickForRow = existingForGame[playerId];
        const isSelfRow = currentPlayer.id === playerId;

        if (!isAdmin) {
            if (!isSelfRow) return;
            if (existingPickForRow && existingPickForRow !== "") {
                setToast({
                    type: "error",
                    message: "You already picked this game. Only the admin can change it.",
                });
                return;
            }
        }

        try {
            const newPredictions = {
                ...existingForGame,
                [playerId]: teamId || "",
            };

            await setDoc(
                doc(db, "picks", gameId),
                {
                    gameId,
                    week: allGames[gameId]?.week ?? week,
                    predictions: newPredictions,
                    updatedAt: Date.now(),
                },
                { merge: true }
            );
            // Firestore onSnapshot updates local state
        } catch (e) {
            console.error("Failed to save pick", e);
            setToast({
                type: "error",
                message: "Failed to save pick. Check console for details.",
            });
        }
    };

    // ==== Standings (weekly + season) ====
    // Compute season stats + list of picks for a single user
    const getUserSeasonStats = useCallback(
        (playerId) => {
            if (!playerId) {
                return {
                    stats: { correct: 0, incorrect: 0, total: 0, pct: 0 },
                    picks: [],
                };
            }

            const gamesArray = Object.values(allGames || {});
            const picksList = [];
            let correct = 0;
            let incorrect = 0;
            let total = 0;

            gamesArray.forEach((game) => {
                const gamePicks = picks[game.id] || {};
                const pickTeamId = gamePicks[playerId];
                if (!pickTeamId) return; // skip games with no pick for this user

                const homeScore = Number(game.home.score);
                const awayScore = Number(game.away.score);

                const hasScores =
                    !Number.isNaN(homeScore) &&
                    !Number.isNaN(awayScore) &&
                    homeScore !== awayScore;

                let result = "pending";
                let winnerTeamId = null;

                if (game.completed && hasScores) {
                    winnerTeamId = homeScore > awayScore ? game.home.id : game.away.id;
                    if (pickTeamId === winnerTeamId) {
                        result = "win";
                        correct += 1;
                        total += 1;
                    } else {
                        result = "loss";
                        incorrect += 1;
                        total += 1;
                    }
                }

                picksList.push({
                    game,
                    pickTeamId,
                    result, // 'win' | 'loss' | 'pending'
                });
            });

            const pct = total > 0 ? correct / total : 0;

            // Sort picks by week, then date
            picksList.sort((a, b) => {
                const wDiff = (a.game.week || 0) - (b.game.week || 0);
                if (wDiff !== 0) return wDiff;
                return new Date(a.game.date) - new Date(b.game.date);
            });

            return {
                stats: { correct, incorrect, total, pct },
                picks: picksList,
            };
        },
        [allGames, picks]
    );

    const myStats = useMemo(
        () => getUserSeasonStats(currentPlayer?.id),
        [currentPlayer?.id, getUserSeasonStats]
    );

    const computeStandings = useCallback(
        (gamesList) => {
            const stats = {};
            players.forEach((p) => {
                stats[p.id] = { correct: 0, total: 0 };
            });

            gamesList.forEach((game) => {
                if (!game.completed) return;

                const homeScore = Number(game.home.score);
                const awayScore = Number(game.away.score);
                if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

                let winnerTeamId = null;
                if (homeScore > awayScore) winnerTeamId = game.home.id;
                else if (awayScore > homeScore) winnerTeamId = game.away.id;
                else return; // ignore ties

                const gamePicks = picks[game.id] || {};
                players.forEach((player) => {
                    const pickTeamId = gamePicks[player.id];
                    if (!pickTeamId) return;
                    stats[player.id].total += 1;
                    if (pickTeamId === winnerTeamId) {
                        stats[player.id].correct += 1;
                    }
                });
            });

            return players
                .map((player) => {
                    const { correct, total } = stats[player.id] || {
                        correct: 0,
                        total: 0,
                    };
                    const pct = total > 0 ? correct / total : 0;
                    return {
                        id: player.id,
                        name: player.name,
                        nickname: player.nickname,
                        displayName: player.displayName,
                        role: player.role,
                        initials: player.initials,
                        color: player.color,
                        profileImageUrl: player.profileImageUrl,
                        correct,
                        total,
                        pct,
                    };
                })
                .sort((a, b) => {
                    if (b.correct !== a.correct) return b.correct - a.correct;
                    return b.pct - a.pct;
                });
        },
        [players, picks]
    );

    const weeklyStandings = useMemo(
        () => computeStandings(games),
        [games, computeStandings]
    );

    const seasonStandings = useMemo(
        () => computeStandings(Object.values(allGames)),
        [allGames, computeStandings]
    );

    // Hide games with no picks at all
    const visibleGames = useMemo(() => {
        if (!hideUnpickedGames) return games;
        return games.filter((game) => {
            const gamePicks = picks[game.id] || {};
            return players.some((p) => !!gamePicks[p.id]);
        });
    }, [games, picks, hideUnpickedGames, players]);

    const topWeekly = weeklyStandings[0];

    const headerDisplayName =
        currentPlayer?.displayName ||
        authUser?.email ||
        "Guest";

    // ==== Excel export/import (admin-import only) ====

    const handleExportWeekToExcel = () => {
        const rows = visibleGames.map((game) => {
            const gamePicks = picks[game.id] || {};
            const row = {
                Week: game.week ?? week,
                GameId: game.id,
                DateUTC: new Date(game.date).toISOString(),
                HomeTeamId: game.home.id,
                HomeTeamAbbrev: game.home.abbrev,
                HomeTeamName: game.home.name,
                AwayTeamId: game.away.id,
                AwayTeamAbbrev: game.away.abbrev,
                AwayTeamName: game.away.name,
            };
            players.forEach((player) => {
                row[player.name] = gamePicks[player.id] || "";
            });
            return row;
        });

        if (rows.length === 0) {
            setToast({
                type: "error",
                message: "No games to export for this week.",
            });
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Week${week}`);
        XLSX.writeFile(workbook, `nfl-picks-week-${week}.xlsx`);

        setToast({
            type: "success",
            message: `Exported week ${week} to Excel.`,
        });
    };

    const handleExportAllWeeksToExcel = () => {
        const allGamesArray = Object.values(allGames);
        if (allGamesArray.length === 0) {
            setToast({
                type: "error",
                message: "No games loaded yet. Visit at least one week first.",
            });
            return;
        }

        const workbook = XLSX.utils.book_new();

        // 1) One sheet per week
        const gamesByWeek = {};
        allGamesArray.forEach((game) => {
            const w = game.week ?? 0;
            if (!gamesByWeek[w]) gamesByWeek[w] = [];
            gamesByWeek[w].push(game);
        });

        Object.keys(gamesByWeek)
            .map(Number)
            .sort((a, b) => a - b)
            .forEach((weekNum) => {
                const rows = gamesByWeek[weekNum].map((game) => {
                    const gamePicks = picks[game.id] || {};
                    const row = {
                        Week: game.week ?? weekNum,
                        GameId: game.id,
                        DateUTC: new Date(game.date).toISOString(),
                        HomeTeamId: game.home.id,
                        HomeTeamAbbrev: game.home.abbrev,
                        HomeTeamName: game.home.name,
                        AwayTeamId: game.away.id,
                        AwayTeamAbbrev: game.away.abbrev,
                        AwayTeamName: game.away.name,
                    };
                    players.forEach((player) => {
                        row[player.name] = gamePicks[player.id] || "";
                    });
                    return row;
                });

                const ws = XLSX.utils.json_to_sheet(rows);
                XLSX.utils.book_append_sheet(
                    workbook,
                    ws,
                    `Week${weekNum}`.slice(0, 31)
                );
            });

        // 2) Season summary standings sheet
        const summaryRows = seasonStandings.map((s, idx) => ({
            Rank: idx + 1,
            Player: s.name,
            Correct: s.correct,
            Total: s.total,
            WinPct: s.total > 0 ? s.pct : 0,
        }));
        const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
        const range = XLSX.utils.decode_range(summarySheet["!ref"]);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: 4 }); // WinPct col
            if (summarySheet[cellRef]) {
                summarySheet[cellRef].z = "0.00%";
            }
        }
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Season_Summary");

        // 3) Win% data sheet
        const winPctRows = seasonStandings.map((s) => ({
            Player: s.name,
            WinPct: s.total > 0 ? s.pct : 0,
        }));
        const winPctSheet = XLSX.utils.json_to_sheet(winPctRows);
        const winRange = XLSX.utils.decode_range(winPctSheet["!ref"]);
        for (let R = winRange.s.r + 1; R <= winRange.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: 1 }); // col B
            if (winPctSheet[cellRef]) {
                winPctSheet[cellRef].z = "0.00%";
            }
        }
        XLSX.utils.book_append_sheet(workbook, winPctSheet, "WinPct_Data");

        XLSX.writeFile(workbook, "nfl-picks-all-weeks.xlsx");

        setToast({
            type: "success",
            message: "Exported all loaded weeks to Excel.",
        });
    };

    const handleImportFromExcel = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!isAdmin) {
            setToast({
                type: "error",
                message: "Only the admin can import picks from Excel.",
            });
            event.target.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });

                const allRows = [];
                workbook.SheetNames.forEach((sheetName) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet);
                    allRows.push(...rows);
                });

                const weekNumbersSet = new Set();
                const importedGameIds = new Set();
                const weekByGameId = {};
                const predictionsByGameId = {};

                allRows.forEach((row) => {
                    const gameId =
                        String(row.GameId ?? row.gameId ?? row["Game ID"] ?? "").trim();
                    if (!gameId) return;
                    importedGameIds.add(gameId);

                    const weekRaw = row.Week ?? row.week ?? row["Week"];
                    const weekNum = Number(weekRaw);
                    if (!Number.isNaN(weekNum) && weekNum >= 1 && weekNum <= 18) {
                        weekNumbersSet.add(weekNum);
                        weekByGameId[gameId] = weekNum;
                    }

                    if (!predictionsByGameId[gameId]) {
                        predictionsByGameId[gameId] = {};
                    }

                    players.forEach((player) => {
                        const val = row[player.name];
                        if (val === undefined || val === null || val === "") return;
                        predictionsByGameId[gameId][player.id] = String(val);
                    });
                });

                // Write all picks to Firestore
                const gameIds = Object.keys(predictionsByGameId);
                await Promise.all(
                    gameIds.map((gameId) =>
                        setDoc(
                            doc(db, "picks", gameId),
                            {
                                gameId,
                                week: weekByGameId[gameId] ?? null,
                                predictions: predictionsByGameId[gameId],
                                updatedAt: Date.now(),
                            },
                            { merge: true }
                        )
                    )
                );

                const weeksToFetch = Array.from(weekNumbersSet);
                if (weeksToFetch.length > 0) {
                    await fetchGamesForWeeksFromAPI(weeksToFetch);
                }

                if (importedGameIds.size > 0) {
                    const weeksLabel =
                        weeksToFetch.length === 0
                            ? "0 weeks"
                            : `${weeksToFetch.length} week${weeksToFetch.length === 1 ? "" : "s"
                            }`;
                    setToast({
                        type: "success",
                        message: `Imported ${importedGameIds.size} game${importedGameIds.size === 1 ? "" : "s"
                            } across ${weeksLabel}.`,
                    });
                } else {
                    setToast({
                        type: "error",
                        message: "No games were found in the imported Excel file.",
                    });
                }
            } catch (err) {
                console.error("Error importing from Excel", err);
                setToast({
                    type: "error",
                    message: "Failed to import from Excel. Check the file format.",
                });
            }
        };

        reader.readAsArrayBuffer(file);
        event.target.value = "";
    };

    // ==== Render ====

    return (
        <div className="app">
            <header className="app-header">
                <div>
                    <h1>NFL Pick&apos;Em</h1>
                    <p>Season {CURRENT_YEAR} · Regular Season</p>
                </div>
            </header>

            {/* Login panel when not signed in */}
            {!authUser && (
                <div className="login-panel-wrapper">
                    <LoginPanel
                        onError={(msg) =>
                            setToast({ type: "error", message: msg || "Auth error." })
                        }
                        onSuccess={(msg) =>
                            setToast({ type: "success", message: msg || "Signed in." })
                        }
                    />
                </div>
            )}

            <div className="layout">
                <main className="main">
                    {/* Controls row */}
                    <div className="controls">
                        <label>
                            Week:&nbsp;
                            <select
                                value={week}
                                onChange={(e) => setWeek(Number(e.target.value))}
                            >
                                {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                                    <option key={w} value={w}>
                                        Week {w}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="auth-panel">
                            {authUser ? (
                                <>
                                    <span className="auth-user">
                                        Signed in as <strong>{headerDisplayName}</strong>{" "}
                                        {isAdmin && <span className="badge">ADMIN</span>}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowUserSettings(true)}
                                    >
                                        Settings
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowMyStats(true)}
                                    >
                                        My Stats
                                    </button>
                                    <button type="button" onClick={handleLogout}>
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <span className="auth-user">Viewing as guest</span>
                            )}
                        </div>

                        {loadingGames && (
                            <span className="status-badge">Loading games…</span>
                        )}
                        {error && (
                            <span className="status-badge error">{error}</span>
                        )}

                        <label
                            style={{
                                marginLeft: "auto",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={hideUnpickedGames}
                                onChange={(e) => setHideUnpickedGames(e.target.checked)}
                            />{" "}
                            Hide games with no picks
                        </label>
                    </div>

                    {/* Excel row */}
                    <div className="controls" style={{ marginTop: "0.25rem" }}>
                        <button type="button" onClick={handleExportWeekToExcel}>
                            Export week to Excel
                        </button>

                        <button type="button" onClick={handleExportAllWeeksToExcel}>
                            Export ALL weeks (multi-sheet)
                        </button>

                        <label className="file-input-label">
                            Import from Excel (admin)
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleImportFromExcel}
                                style={{ display: "none" }}
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => setWinnerModalOpen(true)}
                            disabled={!topWeekly || topWeekly.total === 0}
                        >
                            🏆 Weekly Winner
                        </button>
                    </div>

                    {/* Empty messages */}
                    {!loadingGames && !error && games.length === 0 && (
                        <div className="empty-state">No games found for this week.</div>
                    )}

                    {!loadingGames &&
                        !error &&
                        games.length > 0 &&
                        visibleGames.length === 0 &&
                        hideUnpickedGames && (
                            <div className="empty-state">
                                All games are hidden because they have no picks yet.
                            </div>
                        )}

                    {/* Game list */}
                    <div className="games-list">
                        {visibleGames.map((game) => (
                            <GameCard
                                key={game.id}
                                game={game}
                                players={players}
                                picks={picks[game.id] || {}}
                                currentPlayerId={currentPlayer?.id || null}
                                isAdmin={isAdmin}
                                onPickChange={handlePickChange}
                            />
                        ))}
                    </div>
                </main>

                <aside className="sidebar">
                    <SettingsPanel
                        players={players}
                        currentPlayerId={currentPlayer?.id || null}
                        isAdmin={isAdmin}
                        onUpdatePlayer={handleUpdatePlayer}
                    />

                    <StandingsPanel title="This Week" standings={weeklyStandings} />

                    <StandingsPanel
                        title="Season-to-Date"
                        standings={seasonStandings}
                        note="Based on all games loaded so far; ties ignored."
                    />

                    <WinPctChart title="Season Win%" standings={seasonStandings} />
                </aside>
            </div>

            <WinnerModal
                open={winnerModalOpen}
                onClose={() => setWinnerModalOpen(false)}
                standing={topWeekly}
            />

            <MyStatsPage
                open={showMyStats}
                onClose={() => setShowMyStats(false)}
                player={currentPlayer}
                stats={myStats?.stats || { correct: 0, incorrect: 0, total: 0, pct: 0 }}
                picks={myStats?.picks || []}
            />

            <UserSettingsPage
                open={showUserSettings}
                onClose={() => setShowUserSettings(false)}
                player={currentPlayer}
                onSave={(changes) =>
                    currentPlayer &&
                    setDoc(
                        doc(db, "players", currentPlayer.id),
                        changes,
                        { merge: true }
                    ).catch((e) => {
                        console.error("Failed to save profile", e);
                        setToast({
                            type: "error",
                            message: "Failed to save profile.",
                        });
                    })
                }
            />

            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
}

export default App;