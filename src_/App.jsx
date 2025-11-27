// src/App.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  CLIENT_ID,
  API_KEY,
  DISCOVERY_DOCS,
  SCOPES,
  INITIAL_SPREADSHEET_ID,
  SHEET_NAME,
} from "./googleConfig";
import {
  rowToGame,
  computeStats,
  getWeeks,
  USERS_LIST,
} from "./utils/scoring";

// ESPN endpoint you provided
const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

// Generic script loader
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error(`Failed to load script: ${src}`))
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

function App() {
  const [gapiReady, setGapiReady] = useState(false); // GAPI + GIS fully ready
  const [isAuthorized, setIsAuthorized] = useState(false); // we have a valid token
  const [spreadsheetId, setSpreadsheetId] = useState(INITIAL_SPREADSHEET_ID);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState("ALL");
  const [error, setError] = useState("");
  const [importWeek, setImportWeek] = useState(""); // week tag for ESPN imports

  const tokenClientRef = useRef(null); // GIS token client

  // Form state for adding a game + picks
  const [form, setForm] = useState({
    week: "",
    date: "",
    homeTeam: "",
    awayTeam: "",
    homeScore: "",
    awayScore: "",
    Teddy: "",
    Murk: "",
    Ed: "",
    TD: "",
  });

  // ---- Initialize GAPI (client) + GIS (token client) ----
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setError("");

        // 1) Load GAPI client library
        await loadScript("https://apis.google.com/js/api.js");

        const gapi = window.gapi;
        if (!gapi) throw new Error("gapi not available after loading script");

        // 2) Initialize gapi.client with API key + discovery docs
        await new Promise((resolve, reject) => {
          gapi.load("client", {
            callback: resolve,
            onerror: () => reject(new Error("gapi.client failed to load")),
          });
        });

        await gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });

        if (cancelled) return;

        // 3) Load Google Identity Services (GIS)
        await loadScript("https://accounts.google.com/gsi/client");

        if (cancelled) return;

        const google = window.google;
        if (!google?.accounts?.oauth2) {
          throw new Error("Google Identity Services not available");
        }

        // 4) Create the token client for OAuth2
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES, // "https://www.googleapis.com/auth/spreadsheets"
          callback: (tokenResponse) => {
            if (tokenResponse.error) {
              console.error("Token error:", tokenResponse);
              setError("Authorization failed.");
              return;
            }
            // Attach token to gapi client so Sheets API calls work
            gapi.client.setToken(tokenResponse);
            setIsAuthorized(true);
          },
        });

        tokenClientRef.current = tokenClient;
        setGapiReady(true);
      } catch (err) {
        console.error("Init error:", err);
        if (!cancelled) {
          setError(
            "Google API initialization failed: " +
            (err?.message || String(err))
          );
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load games whenever we're authorized and have a sheet
  useEffect(() => {
    if (gapiReady && isAuthorized && spreadsheetId) {
      fetchGames();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapiReady, isAuthorized, spreadsheetId]);

  // ---- Authorization Handlers (GIS) ----
  function handleAuthorize() {
    const gapi = window.gapi;
    const tokenClient = tokenClientRef.current;

    if (!gapi || !tokenClient) {
      setError("Google API not ready yet.");
      return;
    }

    setError("");

    // Override callback for this specific request
    tokenClient.callback = (tokenResponse) => {
      if (tokenResponse.error) {
        console.error("Token error:", tokenResponse);
        if (tokenResponse.error === "access_denied") {
          setError(
            "Authorization was denied in the Google popup. Please click Authorize and then Allow."
          );
        } else {
          setError("Authorization failed: " + tokenResponse.error);
        }
        return;
      }
      gapi.client.setToken(tokenResponse);
      setIsAuthorized(true);
    };

    // First time: 'consent', subsequent times: '' (no extra prompt)
    tokenClient.requestAccessToken({ prompt: "consent" });
  }

  function handleSignOut() {
    const gapi = window.gapi;
    const google = window.google;

    try {
      if (gapi?.client) {
        const token = gapi.client.getToken();
        if (token && token.access_token && google?.accounts?.oauth2?.revoke) {
          // Revoke token on Google's side
          google.accounts.oauth2.revoke(token.access_token, () => { });
        }
        // Clear in gapi client
        gapi.client.setToken(null);
      }
    } catch (err) {
      console.warn("Error during sign out:", err);
    }

    setIsAuthorized(false);
    setGames([]);
  }

  // ---- Create Spreadsheet ----
  async function handleCreateSpreadsheet() {
    const gapi = window.gapi;
    if (!gapi) {
      setError("Google API not ready yet.");
      return;
    }
    if (!isAuthorized) {
      setError("You must authorize access first.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const response = await gapi.client.sheets.spreadsheets.create({
        properties: {
          title: "NFL Picks Tracker",
        },
        sheets: [
          {
            properties: {
              title: SHEET_NAME,
            },
          },
        ],
      });

      const newId = response.result.spreadsheetId;
      setSpreadsheetId(newId);

      // Initialize header row
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: newId,
        range: `${SHEET_NAME}!A1:K1`,
        valueInputOption: "RAW",
        resource: {
          values: [
            [
              "Week",
              "GameId",
              "Date",
              "HomeTeam",
              "AwayTeam",
              "HomeScore",
              "AwayScore",
              "Teddy",
              "Murk",
              "Ed",
              "TD",
            ],
          ],
        },
      });
    } catch (err) {
      console.error(err);
      setError("Failed to create spreadsheet");
    } finally {
      setLoading(false);
    }
  }

  // ---- Load games from Sheets ----
  async function fetchGames() {
    const gapi = window.gapi;
    if (!gapi) {
      setError("Google API not ready yet.");
      return;
    }
    if (!spreadsheetId) return;

    try {
      setError("");
      setLoading(true);
      const res = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A2:K1000`, // skip header
      });

      const rows = res.result.values || [];
      const parsed = rows.map(rowToGame);
      setGames(parsed);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to load data. Make sure the sheet exists and you have access."
      );
    } finally {
      setLoading(false);
    }
  }

  // ---- Form Handlers ----
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  // ---- Add a game + picks ----
  async function handleAddGame(e) {
    e.preventDefault();
    const gapi = window.gapi;
    if (!gapi) {
      setError("Google API not ready yet.");
      return;
    }
    if (!spreadsheetId) {
      setError("You must create or set a Spreadsheet ID first.");
      return;
    }
    if (!isAuthorized) {
      setError("You must authorize access first.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const week = form.week.trim();
      const date = form.date.trim();
      const homeTeam = form.homeTeam.trim();
      const awayTeam = form.awayTeam.trim();

      if (!week || !homeTeam || !awayTeam) {
        setError("Week, Home Team, and Away Team are required.");
        setLoading(false);
        return;
      }

      // Auto-generate a GameId: 1 + max of existing for that week
      const existingWeekGames = games.filter((g) => g.week === Number(week));
      const nextGameId =
        existingWeekGames.length > 0
          ? Math.max(...existingWeekGames.map((g) => g.gameId || 0)) + 1
          : 1;

      const homeScore = form.homeScore.trim();
      const awayScore = form.awayScore.trim();

      const row = [
        week,
        String(nextGameId),
        date,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        form.Teddy.trim(),
        form.Murk.trim(),
        form.Ed.trim(),
        form.TD.trim(),
      ];

      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAME}!A:K`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: [row],
        },
      });

      // Refresh games
      await fetchGames();

      // Clear form (keep week to speed up multiple entries)
      setForm((f) => ({
        ...f,
        date: "",
        homeTeam: "",
        awayTeam: "",
        homeScore: "",
        awayScore: "",
        Teddy: "",
        Murk: "",
        Ed: "",
        TD: "",
      }));
    } catch (err) {
      console.error(err);
      setError("Failed to add game");
    } finally {
      setLoading(false);
    }
  }

  // ---- Import current ESPN matchups into the sheet ----
  async function handleImportFromESPN() {
    const gapi = window.gapi;
    if (!gapi) {
      setError("Google API not ready yet.");
      return;
    }
    if (!spreadsheetId) {
      setError("You must create or set a Spreadsheet ID first.");
      return;
    }
    if (!isAuthorized) {
      setError("You must authorize access first.");
      return;
    }
    if (!importWeek) {
      setError("Please enter the NFL week number to tag these games with.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      // 1) Fetch ESPN scoreboard (public, non-personalized)
      const res = await fetch(ESPN_SCOREBOARD_URL);
      if (!res.ok) {
        throw new Error(`ESPN API returned ${res.status}`);
      }
      const data = await res.json();

      const events = data.events || [];
      if (!events.length) {
        throw new Error("No events found in ESPN scoreboard response.");
      }

      // 2) Transform to sheet rows
      const rows = events
        .map((ev, idx) => {
          const competitions = ev.competitions || [];
          const comp = competitions[0];
          if (!comp || !comp.competitors) return null;

          const homeComp = comp.competitors.find(
            (c) => c.homeAway === "home"
          );
          const awayComp = comp.competitors.find(
            (c) => c.homeAway === "away"
          );

          const homeTeam = homeComp?.team?.abbreviation || "";
          const awayTeam = awayComp?.team?.abbreviation || "";

          const date = ev.date ? ev.date.slice(0, 10) : ""; // YYYY-MM-DD

          if (!homeTeam || !awayTeam) return null;

          const gameId = idx + 1;

          return [
            String(importWeek),
            String(gameId),
            date,
            homeTeam,
            awayTeam,
            "", // HomeScore
            "", // AwayScore
            "", // Teddy
            "", // Murk
            "", // Ed
            "", // TD
          ];
        })
        .filter(Boolean);

      if (!rows.length) {
        throw new Error("No valid matchups parsed from ESPN scoreboard.");
      }

      // 3) Append to Google Sheet
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAME}!A:K`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          values: rows,
        },
      });

      // 4) Refresh table
      await fetchGames();
    } catch (err) {
      console.error("Import from ESPN failed:", err);
      setError("Failed to import ESPN matchups: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const weeks = getWeeks(games);
  const { statsArray, leaders, leaderMargin } = computeStats(
    games,
    selectedWeek
  );

  return (
    <div className="app-root" style={styles.appRoot}>
      <header style={styles.header}>
        <h1 style={styles.title}>NFL Picks Tracker</h1>
        <div>
          {isAuthorized ? (
            <button style={styles.button} onClick={handleSignOut}>
              Sign Out / Revoke
            </button>
          ) : (
            <button style={styles.button} onClick={handleAuthorize}>
              Authorize with Google
            </button>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {!gapiReady && <p>Loading Google APIs…</p>}

        {error && <p style={styles.error}>{error}</p>}

        {isAuthorized && (
          <>
            <section style={styles.card}>
              <h2>Spreadsheet Setup</h2>
              <p>
                Current Spreadsheet ID:{" "}
                <code>{spreadsheetId || "(none yet)"}</code>
              </p>
              <div style={{ marginTop: 8 }}>
                <button
                  style={styles.button}
                  onClick={handleCreateSpreadsheet}
                  disabled={loading}
                >
                  Create New “NFL Picks Tracker” Sheet
                </button>
              </div>
              <p style={{ marginTop: 8, fontSize: 13 }}>
                If you already have a sheet, paste its ID in{" "}
                <code>INITIAL_SPREADSHEET_ID</code> in{" "}
                <code>googleConfig.js</code> and reload.
              </p>

              {/* ESPN import block */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: "1px solid #1f2937",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13 }}>
                  Import current ESPN matchups as Week:
                </span>
                <input
                  type="number"
                  min="1"
                  name="importWeek"
                  value={importWeek}
                  onChange={(e) => setImportWeek(e.target.value)}
                  style={{ ...styles.input, width: 80 }}
                  placeholder="1"
                />
                <button
                  style={styles.buttonPrimary}
                  onClick={handleImportFromESPN}
                  disabled={loading}
                >
                  Import from ESPN
                </button>
              </div>
            </section>

            <section style={styles.card}>
              <h2>Add Game & Picks</h2>
              <form onSubmit={handleAddGame} style={styles.formGrid}>
                <label style={styles.label}>
                  Week
                  <input
                    type="number"
                    name="week"
                    value={form.week}
                    onChange={handleChange}
                    style={styles.input}
                    required
                  />
                </label>
                <label style={styles.label}>
                  Date
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  Home Team
                  <input
                    name="homeTeam"
                    value={form.homeTeam}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="ATL"
                    required
                  />
                </label>
                <label style={styles.label}>
                  Away Team
                  <input
                    name="awayTeam"
                    value={form.awayTeam}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="NO"
                    required
                  />
                </label>
                <label style={styles.label}>
                  Home Score
                  <input
                    type="number"
                    name="homeScore"
                    value={form.homeScore}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="(optional until final)"
                  />
                </label>
                <label style={styles.label}>
                  Away Score
                  <input
                    type="number"
                    name="awayScore"
                    value={form.awayScore}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="(optional until final)"
                  />
                </label>

                {/* Picks */}
                <label style={styles.label}>
                  Teddy
                  <input
                    name="Teddy"
                    value={form.Teddy}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="ATL or NO"
                  />
                </label>
                <label style={styles.label}>
                  Murk
                  <input
                    name="Murk"
                    value={form.Murk}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="ATL or NO"
                  />
                </label>
                <label style={styles.label}>
                  Ed
                  <input
                    name="Ed"
                    value={form.Ed}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="ATL or NO"
                  />
                </label>
                <label style={styles.label}>
                  TD
                  <input
                    name="TD"
                    value={form.TD}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="ATL or NO"
                  />
                </label>

                <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                  <button
                    type="submit"
                    style={styles.buttonPrimary}
                    disabled={loading}
                  >
                    Add Game
                  </button>
                </div>
              </form>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <h2>Games</h2>
                <button
                  style={styles.button}
                  onClick={fetchGames}
                  disabled={loading}
                >
                  Refresh from Sheet
                </button>
              </div>

              {games.length === 0 ? (
                <p>No games yet.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Week</th>
                        <th>Date</th>
                        <th>Game</th>
                        <th>Score</th>
                        {USERS_LIST.map((u) => (
                          <th key={u}>{u} Pick</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {games.map((g) => (
                        <tr key={`${g.week}-${g.gameId}`}>
                          <td>{g.week}</td>
                          <td>{g.date}</td>
                          <td>
                            {g.homeTeam} vs {g.awayTeam}
                          </td>
                          <td>
                            {g.homeScore != null && g.awayScore != null
                              ? `${g.homeScore} - ${g.awayScore}`
                              : "TBD"}
                          </td>
                          {USERS_LIST.map((u) => (
                            <td key={u}>{g.picks[u]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeaderRow}>
                <h2>Stats & Leaderboard</h2>
                <div>
                  <label style={{ fontSize: 14, marginRight: 8 }}>
                    Week filter:
                  </label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    style={styles.select}
                  >
                    <option value="ALL">All Weeks</option>
                    {weeks.map((w) => (
                      <option key={w} value={w}>
                        Week {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {statsArray.length === 0 ? (
                <p>No stats to show yet.</p>
              ) : (
                <>
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Wins</th>
                          <th>Losses</th>
                          <th>Ties (Games)</th>
                          <th>Games Picked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statsArray.map((s) => (
                          <tr key={s.name}>
                            <td>{s.name}</td>
                            <td>{s.wins}</td>
                            <td>{s.losses}</td>
                            <td>{s.ties}</td>
                            <td>{s.gamesPicked}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    {leaders.length === 1 ? (
                      <p style={styles.leaderText}>
                        <strong>{leaders[0].name}</strong> is leading with{" "}
                        {leaders[0].wins} wins{" "}
                        {selectedWeek === "ALL"
                          ? "overall"
                          : `in Week ${selectedWeek}`}
                        .
                        {leaderMargin > 0 && (
                          <>
                            {" "}
                            They are ahead by {leaderMargin} game
                            {leaderMargin > 1 ? "s" : ""}.
                          </>
                        )}
                      </p>
                    ) : (
                      <p style={styles.leaderText}>
                        There is a tie for the lead between{" "}
                        <strong>{leaders.map((l) => l.name).join(", ")}</strong>{" "}
                        with {leaders[0].wins} wins each{" "}
                        {selectedWeek === "ALL"
                          ? "overall"
                          : `in Week ${selectedWeek}`}
                        .
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        )}

        {!isAuthorized && gapiReady && (
          <section style={styles.card}>
            <h2>How it works</h2>
            <ol style={{ paddingLeft: 20 }}>
              <li>Click “Authorize with Google”.</li>
              <li>
                Approve access to your Google Sheets (only in your account).
              </li>
              <li>Create a new NFL Picks spreadsheet or use an existing one.</li>
              <li>
                (Optional) Import current ESPN matchups for a week, then add
                picks and scores.
              </li>
              <li>
                View weekly and overall stats, including who’s leading and by
                how much.
              </li>
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}

const styles = {
  appRoot: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#f9fafb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    paddingBottom: 40,
  },
  header: {
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #1f2937",
    position: "sticky",
    top: 0,
    background: "#020617cc",
    backdropFilter: "blur(10px)",
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
  },
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "16px",
    display: "grid",
    gap: "16px",
  },
  card: {
    background: "#020617",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #1f2937",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  button: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid #4b5563",
    background: "#111827",
    color: "#f9fafb",
    cursor: "pointer",
    fontSize: 13,
  },
  buttonPrimary: {
    padding: "8px 16px",
    borderRadius: 999,
    border: "none",
    background:
      "linear-gradient(90deg, rgba(34,197,94,1) 0%, rgba(29,78,216,1) 100%)",
    color: "#f9fafb",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  label: {
    fontSize: 13,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  input: {
    borderRadius: 8,
    border: "1px solid #374151",
    padding: "6px 8px",
    background: "#020617",
    color: "#f9fafb",
    fontSize: 13,
  },
  select: {
    borderRadius: 999,
    border: "1px solid #374151",
    padding: "4px 12px",
    background: "#020617",
    color: "#f9fafb",
    fontSize: 13,
  },
  tableWrapper: {
    overflowX: "auto",
    marginTop: 8,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  error: {
    color: "#fecaca",
    background: "#7f1d1d",
    padding: "8px 12px",
    borderRadius: 8,
    marginBottom: 8,
  },
  leaderText: {
    fontSize: 14,
  },
};

export default App;