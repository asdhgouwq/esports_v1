import { useMemo } from 'react';
import TeamIdentity from '../components/TeamIdentity';
import { useMatchData } from '../hooks/useMatchData';
import { LoadingSpinner, ErrorMessage, EmptyState, SectionTitle } from '../components/ui';

export default function TeamsPage() {
  const { matches, loading, error } = useMatchData({ limit: 100 });

  const teams = useMemo(() => {
    const teamMap = Object.create(null);
    matches.forEach(({ team1, team2, win_team, loss_team }) => {
      [team1, team2].forEach((team) => {
        if (!team) return;
        if (!teamMap[team]) teamMap[team] = { team, wins: 0, losses: 0 };
      });
      if (win_team && teamMap[win_team]) teamMap[win_team].wins++;
      if (loss_team && teamMap[loss_team]) teamMap[loss_team].losses++;
    });
    return Object.values(teamMap).sort((a, b) => b.wins - a.wins);
  }, [matches]);

  return (
    <div className="container mx-auto px-4 py-8">
      <SectionTitle>Teams</SectionTitle>

      {loading && <LoadingSpinner message="Loading teams..." />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && teams.length === 0 && (
        <EmptyState message="No teams found. Sync data first." />
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {teams.map(({ team, wins, losses }) => {
            const total = wins + losses;
            const winPct = total ? Math.round((wins / total) * 100) : 0;
            return (
              <div
                key={team}
                className="bg-[#1a1a1a] border border-white/5 hover:border-[#d4af37]/20 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:bg-[#212121] cursor-default"
              >
                <TeamIdentity name={team} className="team-card-identity font-bold text-white text-sm" />
                <div className="flex gap-3 text-xs font-mono">
                  <span className="text-green-400">{wins}W</span>
                  <span className="text-red-400">{losses}L</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-[#d4af37] rounded-full" style={{ width: `${winPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
