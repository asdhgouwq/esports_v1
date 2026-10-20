import { useMemo } from 'react';
import { useMatchData } from '../hooks/useMatchData';
import { LoadingSpinner, ErrorMessage, EmptyState, SectionTitle } from '../components/ui';

export default function StandingsPage() {
  const { matches, loading, error } = useMatchData({ limit: 100 });

  const standings = useMemo(() => {
    const teamMap = Object.create(null);

    matches.forEach((match) => {
      const { team1, team2, win_team, loss_team } = match;
      [team1, team2].forEach((team) => {
        if (!team) return;
        if (!teamMap[team]) teamMap[team] = { team, wins: 0, losses: 0, games: 0 };
      });
      if (win_team && teamMap[win_team]) {
        teamMap[win_team].wins++;
        teamMap[win_team].games++;
      }
      if (loss_team && teamMap[loss_team]) {
        teamMap[loss_team].losses++;
        teamMap[loss_team].games++;
      }
    });

    return Object.values(teamMap).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }, [matches]);

  return (
    <div className="container mx-auto px-4 py-8">
      <SectionTitle>Standings</SectionTitle>

      {loading && <LoadingSpinner message="Calculating standings..." />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && standings.length === 0 && (
        <EmptyState message="No data. Sync matches first." />
      )}

      {!loading && !error && standings.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-600 text-xs border-b border-white/5">
                <th className="text-left px-4 py-3 w-10">#</th>
                <th className="text-left px-4 py-3">Team</th>
                <th className="px-4 py-3">W</th>
                <th className="px-4 py-3">L</th>
                <th className="px-4 py-3">Games</th>
                <th className="px-4 py-3">Win%</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, idx) => {
                const winPct = row.games ? ((row.wins / row.games) * 100).toFixed(0) : 0;
                return (
                  <tr key={row.team} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-white">{row.team}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-green-400">{row.wins}</td>
                    <td className="px-4 py-3 text-center font-mono text-red-400">{row.losses}</td>
                    <td className="px-4 py-3 text-center font-mono text-gray-400">{row.games}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-[#d4af37] rounded-full"
                            style={{ width: `${winPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 font-mono w-8 text-right">{winPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
