import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";

import GameCard from "./components/GameCard";
import StandingsPanel from "./components/StandingsPanel";
import SettingsPanel from "./components/SettingsPanel";
import WinPctChart from "./components/WinPctChart";
import Avatar from "./components/Avatar";
import Toast from "./util/Toast";

const CURRENT_YEAR = new Date().getFullYear();
const BASE_URL =
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const DEFAULT_USERS = [
    { id: "teddy", name: "Teddy", initials: "T", color: "#f97316" },
    { id: "murk", name: "Murk", initials: "M", color: "#22c55e" },
    { id: "ed", name: "Ed", initials: "E", color: "#3b82f6" },
    { id: "td", name: "TD", initials: "TD", color: "#eab308" },
];

function App() {
    const [week, setWeek] = useState(1);
    const [games, setGames] = useState([]); // current week games
    const [allGames, setAllGames] = useState({}); // { [gameId]: game } across all loaded weeks
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [predictions, setPredictions] = useState({}); // { [gameId]: { [userId]: teamId } }
    const [hideUnpickedGames, setHideUnpickedGames] = useState(false);
    const [users, setUsers] = useState(DEFAULT_USERS);
    const [winnerModalOpen, setWinnerModalOpen] = useState(false);
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

    // Auto-dismiss toast after 4s
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    // Load saved users + predictions from localStorage
    useEffect(() => {
        try {
            const savedUsers = localStorage.getItem("nflUsers");
            if (savedUsers) {
                setUsers(JSON.parse(savedUsers));
            }
        } catch (e) {
            console.error("Failed to load users from localStorage", e);
        }

        try {
            const saved = localStorage.getItem("nflPredictions");
            if (saved) {
                setPredictions(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load predictions from localStorage", e);
        }
    }, []);

    // Persist users + predictions
    useEffect(() => {
        try {
            localStorage.setItem("nflUsers", JSON.stringify(users));
        } catch (e) {
            console.error("Failed to save users", e);
        }
    }, [users]);

    useEffect(() => {
        try {
            localStorage.setItem("nflPredictions", JSON.stringify(predictions));
        } catch (e) {
            console.error("Failed to save predictions", e);
        }
    }, [predictions]);

    useEffect(() => {
        fetchGames(week);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [week]);

    const parseScoreboardGame = (e, weekNumber) => {
        const competition = e.competitions?.[0] || {};
        const competitors = competition.competitors || [];

        const home = competitors.find((c) => c.homeAway === "home") || {};
        const away = competitors.find((c) => c.homeAway === "away") || {};

        const homeTeam = home.team || {};
        const awayTeam = away.team || {};

        return {
            id: e.id,
            week: weekNumber,
            date: e.date,
            statusText:
                e.status?.type?.shortDetail || e.status?.type?.description || "TBD",
            completed: Boolean(e.status?.type?.completed),
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
        setLoading(true);
        setError("");
        try {
            const url = `${BASE_URL}?year=${CURRENT_YEAR}&seasontype=2&week=${weekNumber}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            const events = data.events || [];

            const parsedGames = events.map((e) => parseScoreboardGame(e, weekNumber));

            setGames(parsedGames);

            // Merge into "allGames" for season stats
            setAllGames((prev) => {
                const updated = { ...prev };
                parsedGames.forEach((g) => {
                    updated[g.id] = g;
                });
                return updated;
            });
        } catch (err) {
            console.error(err);
            setError("Failed to load games. Check console and/or CORS issues.");
        } finally {
            setLoading(false);
        }
    };

    // Helper: fetch games for multiple weeks (used when importing all weeks from Excel)
    const fetchGamesForWeeksFromAPI = async (weekNumbers) => {
        if (!weekNumbers || weekNumbers.length === 0) return;
        try {
            setLoading(true);
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
                    "Imported predictions, but some weeks could not be loaded from ESPN.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePredictionChange = (gameId, userId, teamId) => {
        setPredictions((prev) => ({
            ...prev,
            [gameId]: {
                ...(prev[gameId] || {}),
                [userId]: teamId || undefined,
            },
        }));
    };

    const handleUpdateUser = (userId, changes) => {
        setUsers((prev) =>
            prev.map((u) => {
                if (u.id !== userId) return u;
                const updated = { ...u, ...changes };
                if (changes.name !== undefined && changes.name.trim() !== "") {
                    updated.initials = changes.name.trim()[0].toUpperCase();
                }
                return updated;
            })
        );
    };

    // Shared standings computation: given an array of games, compute per-user stats
    const computeStandings = (gamesArray, predictionsMap, usersList) => {
        const stats = {};
        usersList.forEach((u) => {
            stats[u.id] = { correct: 0, total: 0 };
        });

        gamesArray.forEach((game) => {
            if (!game.completed) return;

            const homeScore = Number(game.home.score);
            const awayScore = Number(game.away.score);
            if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

            let winnerId = null;
            if (homeScore > awayScore) winnerId = game.home.id;
            else if (awayScore > homeScore) winnerId = game.away.id;
            else return; // ignore ties

            const picks = predictionsMap[game.id] || {};
            usersList.forEach((user) => {
                const pick = picks[user.id];
                if (!pick) return;
                stats[user.id].total += 1;
                if (pick === winnerId) {
                    stats[user.id].correct += 1;
                }
            });
        });

        return usersList
            .map((user) => {
                const { correct, total } = stats[user.id];
                const pct = total > 0 ? correct / total : 0;
                return {
                    userId: user.id,
                    name: user.name,
                    initials: user.initials,
                    color: user.color,
                    correct,
                    total,
                    pct,
                };
            })
            .sort((a, b) => {
                if (b.correct !== a.correct) return b.correct - a.correct;
                return b.pct - a.pct;
            });
    };

    // Weekly standings (current week)
    const weeklyStandings = useMemo(
        () => computeStandings(games, predictions, users),
        [games, predictions, users]
    );

    // Season-to-date standings (all loaded games)
    const seasonStandings = useMemo(
        () => computeStandings(Object.values(allGames), predictions, users),
        [allGames, predictions, users]
    );

    // Hide games with no predictions
    const visibleGames = useMemo(() => {
        if (!hideUnpickedGames) return games;
        return games.filter((game) => {
            const picks = predictions[game.id] || {};
            return users.some((user) => !!picks[user.id]);
        });
    }, [games, predictions, hideUnpickedGames, users]);

    // Export current week to Excel
    const handleExportToExcel = () => {
        const rows = visibleGames.map((game) => {
            const gamePreds = predictions[game.id] || {};
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
            users.forEach((user) => {
                row[user.name] = gamePreds[user.id] || "";
            });
            return row;
        });

        if (rows.length === 0) {
            alert("No games to export for this week.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Week${week}`);
        XLSX.writeFile(workbook, `nfl-picks-week-${week}.xlsx`);
    };

    // Export ALL weeks (multi-sheet + summary + win% data)
    const handleExportAllWeeksToExcel = () => {
        const allGamesArray = Object.values(allGames);
        if (allGamesArray.length === 0) {
            alert("No games loaded yet. Visit at least one week first.");
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
                    const gamePreds = predictions[game.id] || {};
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
                    users.forEach((user) => {
                        row[user.name] = gamePreds[user.id] || "";
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
            User: s.name,
            Correct: s.correct,
            Total: s.total,
            WinPct: s.total > 0 ? s.pct : 0, // fraction (0–1)
        }));
        const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
        const range = XLSX.utils.decode_range(summarySheet["!ref"]);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: 4 }); // column E
            if (summarySheet[cellRef]) {
                summarySheet[cellRef].z = "0.00%";
            }
        }
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Season_Summary");

        // 3) Win % by user data sheet
        const winPctRows = seasonStandings.map((s) => ({
            User: s.name,
            WinPct: s.total > 0 ? s.pct : 0,
        }));
        const winPctSheet = XLSX.utils.json_to_sheet(winPctRows);
        const winRange = XLSX.utils.decode_range(winPctSheet["!ref"]);
        for (let R = winRange.s.r + 1; R <= winRange.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: 1 }); // column B
            if (winPctSheet[cellRef]) {
                winPctSheet[cellRef].z = "0.00%";
            }
        }
        XLSX.utils.book_append_sheet(workbook, winPctSheet, "WinPct_Data");

        XLSX.writeFile(workbook, "nfl-picks-all-weeks.xlsx");
    };

    // Import predictions (and weeks) from Excel – handles both single-week and multi-sheet files
    const handleImportFromExcel = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

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

                setPredictions((prev) => {
                    const updated = { ...prev };

                    allRows.forEach((row) => {
                        const gameId =
                            String(row.GameId ?? row.gameId ?? row["Game ID"] ?? "").trim();
                        if (!gameId) return;
                        importedGameIds.add(gameId);

                        const weekRaw = row.Week ?? row.week ?? row["Week"];
                        const weekNum = Number(weekRaw);
                        if (!Number.isNaN(weekNum) && weekNum >= 1 && weekNum <= 18) {
                            weekNumbersSet.add(weekNum);
                        }

                        if (!updated[gameId]) updated[gameId] = {};
                        users.forEach((user) => {
                            const val = row[user.name];
                            if (val === undefined || val === null || val === "") return;
                            updated[gameId][user.id] = String(val);
                        });
                    });

                    return updated;
                });

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
                            } across ${weeksLabel} for ${users.length} players.`,
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
        // Allow selecting the same file again if needed
        event.target.value = "";
    };

    const topWeekly = weeklyStandings[0];

    return (
        <div className="app">
            <header className="app-header">
                <h1>NFL Weekly Pick&apos;Em</h1>
                <p>
                    Data from ESPN Scoreboard API · Season {CURRENT_YEAR}, Regular Season
                </p>
            </header>

            <div className="layout">
                <main className="main">
                    {/* Top controls row */}
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

                        {loading && <span className="status-badge">Loading…</span>}
                        {error && <span className="status-badge error">{error}</span>}

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
                            Hide games with no predictions
                        </label>
                    </div>

                    {/* Excel + Winner controls row */}
                    <div className="controls" style={{ marginTop: "0.25rem" }}>
                        <button type="button" onClick={handleExportToExcel}>
                            Export week to Excel
                        </button>

                        <button type="button" onClick={handleExportAllWeeksToExcel}>
                            Export ALL weeks (multi-sheet)
                        </button>

                        <label className="file-input-label">
                            Import from Excel (all weeks)
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

                    {/* Empty-state messages */}
                    {!loading && !error && games.length === 0 && (
                        <div className="empty-state">No games found for this week.</div>
                    )}

                    {!loading &&
                        !error &&
                        games.length > 0 &&
                        visibleGames.length === 0 &&
                        hideUnpickedGames && (
                            <div className="empty-state">
                                All games are hidden because they have no predictions yet.
                            </div>
                        )}

                    {/* Games list */}
                    <div className="games-list">
                        {visibleGames.map((game) => (
                            <GameCard
                                key={game.id}
                                game={game}
                                users={users}
                                predictions={predictions[game.id] || {}}
                                onPredictionChange={handlePredictionChange}
                            />
                        ))}
                    </div>
                </main>

                <aside className="sidebar">
                    <SettingsPanel users={users} onUpdateUser={handleUpdateUser} />

                    <StandingsPanel title="This Week" standings={weeklyStandings} />

                    <StandingsPanel
                        title="Season-to-Date"
                        standings={seasonStandings}
                        note="Based on all games loaded across weeks; ties are ignored."
                    />

                    <WinPctChart title="Season Win%" standings={seasonStandings} />
                </aside>
            </div>

            <WinnerModal
                open={winnerModalOpen}
                onClose={() => setWinnerModalOpen(false)}
                standing={topWeekly}
            />

            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
}

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
                    <h3 className="winner-name">{standing.name}</h3>
                    <p className="winner-stats">
                        {standing.correct} / {standing.total} correct ({winPct}%)
                    </p>
                </div>
            </div>
        </div>
    );
}

export default App;