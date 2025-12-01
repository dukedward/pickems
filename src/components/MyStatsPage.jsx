import React, { useMemo, useState } from "react";
import Avatar from "./Avatar";

function MyStatsPage({ open, onClose, player, stats, picks }) {
    // All hooks must be at the top:
    const [filterWeek, setFilterWeek] = useState("all");

    // Safe fallbacks so we never explode on null/undefined
    const safePlayer = player || {};
    const safePicks = Array.isArray(picks) ? picks : [];

    const defaultStats = { correct: 0, incorrect: 0, total: 0, pct: 0 };
    const mergedStats =
        stats && typeof stats.total === "number"
            ? { ...defaultStats, ...stats }
            : defaultStats;

    const displayName =
        safePlayer.displayName || safePlayer.name || "Player";

    const seasonWinPct =
        mergedStats.total > 0 ? (mergedStats.pct * 100).toFixed(1) : "0.0";

    // Unique list of weeks the user has picks for
    const availableWeeks = useMemo(() => {
        const set = new Set();
        safePicks.forEach(({ game }) => {
            if (game?.week != null) set.add(game.week);
        });
        return Array.from(set).sort((a, b) => a - b);
    }, [safePicks]);

    // Weekly stats for sparkline: [{ week, correct, incorrect, total, pct }]
    const weeklyStats = useMemo(() => {
        const byWeek = new Map();
        safePicks.forEach(({ game, result }) => {
            if (!game) return;
            const w = game.week ?? 0;
            if (!w) return;
            if (!byWeek.has(w)) {
                byWeek.set(w, { week: w, correct: 0, incorrect: 0, total: 0 });
            }
            const entry = byWeek.get(w);
            if (result === "win") {
                entry.correct += 1;
                entry.total += 1;
            } else if (result === "loss") {
                entry.incorrect += 1;
                entry.total += 1;
            }
            // pending does not affect totals
        });

        const arr = Array.from(byWeek.values()).sort(
            (a, b) => a.week - b.week
        );
        return arr.map((e) => ({
            ...e,
            pct: e.total > 0 ? e.correct / e.total : 0,
        }));
    }, [safePicks]);

    // Filtered picks for table
    const filteredPicks = useMemo(() => {
        if (filterWeek === "all") return safePicks;
        const weekNum = Number(filterWeek);
        return safePicks.filter((p) => p.game?.week === weekNum);
    }, [safePicks, filterWeek]);

    // Quick stats for the filtered view
    const filteredStats = useMemo(() => {
        let correct = 0;
        let incorrect = 0;
        filteredPicks.forEach((p) => {
            if (p.result === "win") correct += 1;
            else if (p.result === "loss") incorrect += 1;
        });
        const total = correct + incorrect;
        const pct = total > 0 ? correct / total : 0;
        return { correct, incorrect, total, pct };
    }, [filteredPicks]);

    const filteredWinPct =
        filteredStats.total > 0
            ? (filteredStats.pct * 100).toFixed(1)
            : "0.0";

    // Recent picks: last 5 (from full season), newest first
    const recentPicks = useMemo(() => {
        if (!safePicks || safePicks.length === 0) return [];
        const last = safePicks.slice(-5).reverse();
        return last;
    }, [safePicks]);

    // Sparkline geometry
    const sparkWidth = 220;
    const sparkHeight = 48;
    const sparkPadding = 4;

    const sparkPoints = useMemo(() => {
        if (!weeklyStats || weeklyStats.length === 0) return "";

        const n = weeklyStats.length;
        const maxPct = 1;
        const minPct = 0;

        const innerWidth = sparkWidth - sparkPadding * 2;
        const innerHeight = sparkHeight - sparkPadding * 2;

        if (n === 1) {
            const pct = weeklyStats[0].pct;
            const yFrac =
                maxPct === minPct ? 0.5 : 1 - (pct - minPct) / (maxPct - minPct);
            const x = sparkPadding + innerWidth / 2;
            const y = sparkPadding + yFrac * innerHeight;
            return `${x},${y}`;
        }

        return weeklyStats
            .map((entry, i) => {
                const pct = entry.pct;
                const x =
                    sparkPadding +
                    (innerWidth * i) / (n - 1 || 1);
                const yFrac =
                    maxPct === minPct ? 0.5 : 1 - (pct - minPct) / (maxPct - minPct);
                const y = sparkPadding + yFrac * innerHeight;
                return `${x},${y}`;
            })
            .join(" ");
    }, [weeklyStats]);

    // ✅ Hooks are all declared; NOW we can bail out safely if closed or no player yet
    if (!open || !player) return null;

    return (
        <div className="user-settings-backdrop" onClick={onClose}>
            <div
                className="user-settings"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="user-settings-header">
                    <h2>My Stats</h2>
                    <button
                        className="modal-close"
                        type="button"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>

                <div className="user-settings-body">
                    {/* Left column: summary + sparkline + recent picks */}
                    <div className="user-avatar-block">
                        <Avatar
                            initials={safePlayer.initials}
                            color={safePlayer.color}
                            imageUrl={safePlayer.profileImageUrl}
                            size={72}
                            alt={displayName}
                        />
                        <p className="user-settings-displayname">{displayName}</p>

                        <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                            <div>
                                <strong>Season win%:</strong> {seasonWinPct}%
                            </div>
                            <div>
                                <strong>Correct:</strong> {mergedStats.correct}
                            </div>
                            <div>
                                <strong>Incorrect:</strong> {mergedStats.incorrect}
                            </div>
                            <div>
                                <strong>Total picks:</strong> {mergedStats.total}
                            </div>
                        </div>

                        <p className="user-settings-hint">
                            Season stats include all completed games with picks and a
                            non-tied score.
                        </p>

                        {/* Weekly win% sparkline */}
                        <div className="mystats-sparkline">
                            <div className="mystats-sparkline-header">
                                <span>Weekly win% trend</span>
                            </div>
                            {weeklyStats.length === 0 ? (
                                <p className="standings-empty">
                                    Make some picks to see your weekly trend.
                                </p>
                            ) : (
                                <>
                                    <svg
                                        width="100%"
                                        height={sparkHeight}
                                        viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
                                        preserveAspectRatio="none"
                                    >
                                        <rect
                                            x="0"
                                            y="0"
                                            width={sparkWidth}
                                            height={sparkHeight}
                                            rx="8"
                                            ry="8"
                                            className="mystats-sparkline-bg"
                                        />
                                        <line
                                            x1={sparkPadding}
                                            x2={sparkWidth - sparkPadding}
                                            y1={sparkHeight / 2}
                                            y2={sparkHeight / 2}
                                            className="mystats-sparkline-midline"
                                        />
                                        <polyline
                                            points={sparkPoints}
                                            className="mystats-sparkline-line"
                                            fill="none"
                                        />
                                        {weeklyStats.map((entry, i) => {
                                            const n = weeklyStats.length;
                                            const innerWidth =
                                                sparkWidth - sparkPadding * 2;
                                            const innerHeight =
                                                sparkHeight - sparkPadding * 2;

                                            const pct = entry.pct;
                                            const x =
                                                sparkPadding +
                                                (innerWidth *
                                                    (n === 1 ? 0.5 : i / (n - 1 || 1)));
                                            const yFrac = 1 - pct;
                                            const y =
                                                sparkPadding + yFrac * innerHeight;

                                            return (
                                                <circle
                                                    key={entry.week}
                                                    cx={x}
                                                    cy={y}
                                                    r={2.5}
                                                    className="mystats-sparkline-dot"
                                                />
                                            );
                                        })}
                                    </svg>
                                    <div className="mystats-sparkline-labels">
                                        {weeklyStats.map((entry) => (
                                            <span key={entry.week}>W{entry.week}</span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Recent picks */}
                        <div className="mystats-recent">
                            <h3>Recent picks</h3>
                            {recentPicks.length === 0 ? (
                                <p className="standings-empty">
                                    No picks made yet this season.
                                </p>
                            ) : (
                                <ul className="mystats-recent-list">
                                    {recentPicks.map(({ game, pickTeamId, result }, idx) => {
                                        if (!game) return null;

                                        const isHomePick = pickTeamId === game.home.id;
                                        const pickAbbrev = isHomePick
                                            ? game.home.abbrev
                                            : game.away.abbrev;

                                        const dateStr = new Date(
                                            game.date
                                        ).toLocaleDateString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                        });

                                        let resultLabel = "Pending";
                                        if (result === "win") resultLabel = "Win";
                                        if (result === "loss") resultLabel = "Loss";

                                        return (
                                            <li key={`${game.id}-${idx}`}>
                                                <div className="mystats-recent-top">
                                                    <div>
                                                        <span className="mystats-recent-week">
                                                            W{game.week ?? "?"}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="mystats-recent-match">
                                                            {game.away.abbrev} @ {game.home.abbrev}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="mystats-recent-bottom">
                                                    <div>
                                                        <span className="mystats-recent-pick">
                                                            Pick: <strong>{pickAbbrev}</strong>
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span
                                                            className={
                                                                "mystats-recent-status " +
                                                                (result === "win"
                                                                    ? "mystats-win"
                                                                    : result === "loss"
                                                                        ? "mystats-loss"
                                                                        : "mystats-pending")
                                                            }
                                                        >
                                                            Result: {resultLabel}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="mystats-recent-date">
                                                            Date: {dateStr}
                                                        </span>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Right column: filter + picks table */}
                    <div className="user-settings-right">
                        <div className="mystats-header-row">
                            <h3 style={{ marginTop: 0, marginBottom: "0.4rem" }}>
                                All Season Picks
                            </h3>
                            <div className="mystats-filter">
                                <label>
                                    Filter by week:&nbsp;
                                    <select
                                        value={filterWeek}
                                        onChange={(e) => setFilterWeek(e.target.value)}
                                    >
                                        <option value="all">All weeks</option>
                                        {availableWeeks.map((w) => (
                                            <option key={w} value={w}>
                                                Week {w}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div className="mystats-filter-summary">
                            {filterWeek === "all" ? (
                                <span>Showing picks from the entire season.</span>
                            ) : (
                                <span>
                                    Week {filterWeek}: {filteredStats.correct}–
                                    {filteredStats.incorrect} (
                                    {filteredStats.total > 0 ? filteredWinPct : "0.0"}
                                    %)
                                </span>
                            )}
                        </div>

                        {filteredPicks.length === 0 ? (
                            <p className="standings-empty">
                                {filterWeek === "all"
                                    ? "You haven't made any picks yet."
                                    : "No picks for this week."}
                            </p>
                        ) : (
                            <div className="mystats-table-wrapper">
                                <table className="standings-table">
                                    <thead>
                                        <tr>
                                            <th>Week</th>
                                            <th>Date</th>
                                            <th>Matchup</th>
                                            <th>Your Pick</th>
                                            <th>Result</th>
                                            <th>Score / Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPicks.map(
                                            ({ game, pickTeamId, result }, idx) => {
                                                if (!game) return null;

                                                const isHomePick = pickTeamId === game.home.id;
                                                const pickLabel = isHomePick
                                                    ? `${game.home.abbrev} (${game.home.name})`
                                                    : `${game.away.abbrev} (${game.away.name})`;

                                                const dateStr = new Date(
                                                    game.date
                                                ).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                });

                                                let resultLabel = "Pending";
                                                if (result === "win") resultLabel = "Win";
                                                if (result === "loss") resultLabel = "Loss";

                                                let scoreLabel = game.statusText || "";
                                                const homeScore = game.home.score;
                                                const awayScore = game.away.score;
                                                if (
                                                    game.completed &&
                                                    homeScore !== "" &&
                                                    awayScore !== ""
                                                ) {
                                                    scoreLabel = `${game.away.abbrev} ${awayScore} – ${game.home.abbrev} ${homeScore}`;
                                                }

                                                return (
                                                    <tr key={`${game.id}-${idx}`}>
                                                        <td>{game.week ?? "—"}</td>
                                                        <td>{dateStr}</td>
                                                        <td>
                                                            {game.away.abbrev} @ {game.home.abbrev}
                                                        </td>
                                                        <td>{pickLabel}</td>
                                                        <td
                                                            className={
                                                                result === "win"
                                                                    ? "mystats-win"
                                                                    : result === "loss"
                                                                        ? "mystats-loss"
                                                                        : "mystats-pending"
                                                            }
                                                        >
                                                            {resultLabel}
                                                        </td>
                                                        <td>{scoreLabel}</td>
                                                    </tr>
                                                );
                                            }
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MyStatsPage;