import { Link } from 'react-router-dom';
import { useDDragon } from '../contexts/DDragonContext';
import { getChampionImageUrl, formatDate, formatGameLength } from '../lib/utils';

export default function MatchCard({ match }) {
  const { version } = useDDragon();

  const team1Picks = match.team1_picks ? match.team1_picks.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const team2Picks = match.team2_picks ? match.team2_picks.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const team1Bans = match.team1_bans ? match.team1_bans.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const team2Bans = match.team2_bans ? match.team2_bans.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const team1Win = match.win_team === match.team1;
  const team2Win = match.win_team === match.team2;

  return (
    <Link
      to={`/match/${match.game_id}`}
      className="block bg-[#1a1a1a] hover:bg-[#212121] border border-white/5 hover:border-[#d4af37]/20 rounded-xl p-4 transition-all duration-200 group"
    >
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="text-gray-500 text-xs w-full md:w-28 shrink-0 text-center md:text-left">
          <div className="text-white/40 mb-0.5">{match.tournament}</div>
          <div>{formatDate(match.datetime_utc)}</div>
          {match.patch && <div className="text-[#d4af37]/60 mt-0.5">Patch {match.patch}</div>}
        </div>

        <div className="flex items-center gap-4 flex-1 justify-center">
          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-sm font-bold ${team1Win ? 'text-green-400' : 'text-gray-400'}`}>
              {match.team1}
              {team1Win && <span className="ml-1.5 text-xs text-green-400/60">WIN</span>}
            </span>
            <div className="flex gap-1">
              {team1Picks.map((champ, i) => (
                <img
                  key={i}
                  src={getChampionImageUrl(version, champ)}
                  alt={champ}
                  title={champ}
                  className="w-7 h-7 rounded-full border border-blue-900/50 object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ))}
            </div>
            {team1Bans.length > 0 && (
              <div className="flex gap-1">
                {team1Bans.map((champ, i) => (
                  <div key={i} className="relative">
                    <img
                      src={getChampionImageUrl(version, champ)}
                      alt={champ}
                      title={`Ban: ${champ}`}
                      className="w-4 h-4 rounded-full opacity-30 grayscale"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-px bg-red-500/70 rotate-45" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-1 text-center">
            <div className="text-gray-600 text-xs font-mono">VS</div>
            {match.gamelength_number && (
              <div className="text-[10px] text-gray-600 font-mono">{formatGameLength(match.gamelength_number)}</div>
            )}
          </div>

          <div className="flex flex-col items-start gap-1.5">
            <span className={`text-sm font-bold ${team2Win ? 'text-green-400' : 'text-gray-400'}`}>
              {team2Win && <span className="mr-1.5 text-xs text-green-400/60">WIN</span>}
              {match.team2}
            </span>
            <div className="flex gap-1">
              {team2Picks.map((champ, i) => (
                <img
                  key={i}
                  src={getChampionImageUrl(version, champ)}
                  alt={champ}
                  title={champ}
                  className="w-7 h-7 rounded-full border border-red-900/50 object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ))}
            </div>
            {team2Bans.length > 0 && (
              <div className="flex gap-1">
                {team2Bans.map((champ, i) => (
                  <div key={i} className="relative">
                    <img
                      src={getChampionImageUrl(version, champ)}
                      alt={champ}
                      title={`Ban: ${champ}`}
                      className="w-4 h-4 rounded-full opacity-30 grayscale"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-px bg-red-500/70 rotate-45" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 text-gray-600 group-hover:text-[#d4af37] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
