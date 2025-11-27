// src/utils/scoring.js

const USERS = ["Teddy", "Murk", "Ed", "TD"];

// Transform a raw row from Sheets into an object
export function rowToGame(row) {
    // Expected order:
    // [Week, GameId, Date, HomeTeam, AwayTeam, HomeScore, AwayScore, Teddy, Murk, Ed, TD]
    const [
        weekStr,
        gameIdStr,
        date,
        homeTeam,
        awayTeam,
        homeScoreStr,
        awayScoreStr,
        teddy,
        murk,
        ed,
        td,
    ] = row;

    const week = Number(weekStr);
    const gameId = Number(gameIdStr);
    const homeScore = homeScoreStr === "" ? null : Number(homeScoreStr);
    const awayScore = awayScoreStr === "" ? null : Number(awayScoreStr);

    const picks = {
        Teddy: (teddy || "").trim(),
        Murk: (murk || "").trim(),
        Ed: (ed || "").trim(),
        TD: (td || "").trim(),
    };

    return {
        week,
        gameId,
        date,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        picks,
    };
}

// Determine the winner label: "HOME", "AWAY", or "TIE" or null (if no scores yet)
export function getWinner(game) {
    if (
        game.homeScore === null ||
        game.homeScore === undefined ||
        game.awayScore === null ||
        game.awayScore === undefined
    ) {
        return null; // game not finished yet
    }
    if (game.homeScore > game.awayScore) return "HOME";
    if (game.awayScore > game.homeScore) return "AWAY";
    return "TIE";
}

// Check if a user's pick is correct
export function didUserWinGame(game, userName) {
    const winner = getWinner(game);
    if (!winner || winner === "TIE") return false;

    const pickTeam = (game.picks[userName] || "").toUpperCase();
    if (!pickTeam) return false;

    const winningTeam =
        winner === "HOME"
            ? (game.homeTeam || "").toUpperCase()
            : (game.awayTeam || "").toUpperCase();

    return pickTeam === winningTeam;
}

// Aggregate stats for a list of games (optionally filtered by week)
export function computeStats(games, selectedWeek = "ALL") {
    const filteredGames =
        selectedWeek === "ALL"
            ? games
            : games.filter((g) => g.week === Number(selectedWeek));

    const userStats = {};
    USERS.forEach((u) => {
        userStats[u] = {
            name: u,
            wins: 0,
            losses: 0,
            ties: 0, // games that ended in tie
            gamesPicked: 0,
        };
    });

    for (const game of filteredGames) {
        const winner = getWinner(game);
        if (!winner) continue; // skip unfinished

        const isTie = winner === "TIE";

        USERS.forEach((u) => {
            const pick = game.picks[u];
            if (!pick) return; // user didn't pick this game

            userStats[u].gamesPicked += 1;

            if (isTie) {
                userStats[u].ties += 1;
            } else if (didUserWinGame(game, u)) {
                userStats[u].wins += 1;
            } else {
                userStats[u].losses += 1;
            }
        });
    }

    const statsArray = Object.values(userStats);

    // Determine leader(s)
    const maxWins = Math.max(...statsArray.map((s) => s.wins));
    const leaders = statsArray.filter((s) => s.wins === maxWins);

    // Sort stats by wins desc
    statsArray.sort((a, b) => b.wins - a.wins);

    // Leader margin: difference between 1st & 2nd (if exists)
    let leaderMargin = 0;
    if (statsArray.length > 1) {
        leaderMargin = statsArray[0].wins - statsArray[1].wins;
    }

    return {
        statsArray,
        leaders,
        leaderMargin,
    };
}

// Return unique weeks from games
export function getWeeks(games) {
    const weeks = Array.from(new Set(games.map((g) => g.week))).sort(
        (a, b) => a - b
    );
    return weeks;
}

export const USERS_LIST = USERS;