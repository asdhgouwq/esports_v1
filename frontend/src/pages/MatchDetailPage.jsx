import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import '../styles/match-detail.css';
import { useMatchStats } from '../hooks/useMatchStats';
import { useMatchData } from '../hooks/useMatchData';
import { useDDragon } from '../contexts/DDragonContext';
import { getChampionImageUrl, getItemImageUrl, formatDate, formatGameLength } from '../lib/utils';
import { LoadingSpinner, ErrorMessage } from '../components/ui';
import MatchSummary from '../components/MatchSummary';
import AiMatchSummary from '../components/AiMatchSummary';
import TournamentDraft from '../components/TournamentDraft';
import { useMatchDraft } from '../hooks/useMatchDraft';

const ROLE_ORDER = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
const MATCH_TABS = [{ id: 'preview', label: 'Preview', detail: '경기 전' }, ...Array.from({ length: 5 }, (_, i) => ({ id: `set-${i + 1}`, label: `${i + 1}세트` })), { id: 'summary', label: '요약', detail: '경기 총평' }];

function PlayerRow({ player, version, isWinner }) {
  const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5].filter(Boolean);

  return (
    <tr className={`border-b border-white/5 hover:bg-white/3 transition-colors ${isWinner ? 'bg-green-900/5' : ''}`}>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <img
            src={getChampionImageUrl(version, player.champion)}
            alt={player.champion}
            className="w-8 h-8 rounded-full border border-white/10"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <div className="text-white text-sm font-semibold">{player.name}</div>
            <div className="text-gray-500 text-xs">{player.champion}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">{player.role}</span>
      </td>
      <td className="px-3 py-2.5 text-center font-mono text-sm">
        <span className="text-green-400">{player.kills}</span>
        <span className="text-gray-600 mx-1">/</span>
        <span className="text-red-400">{player.deaths}</span>
        <span className="text-gray-600 mx-1">/</span>
        <span className="text-blue-400">{player.assists}</span>
      </td>
      <td className="px-3 py-2.5 text-center text-sm text-yellow-300/80 font-mono">
        {player.gold ? `${(player.gold / 1000).toFixed(1)}k` : '-'}
      </td>
      <td className="px-3 py-2.5 text-center text-sm text-gray-300 font-mono">{player.cs ?? '-'}</td>
      <td className="px-3 py-2.5 text-center text-sm text-red-300/70 font-mono">
        {player.damage_to_champions ? `${(player.damage_to_champions / 1000).toFixed(1)}k` : '-'}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1">
          {items.map((itemId, i) => (
            <img
              key={i}
              src={getItemImageUrl(version, itemId)}
              alt={itemId}
              title={itemId}
              className="w-6 h-6 rounded border border-white/10"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ))}
        </div>
      </td>
    </tr>
  );
}

function TeamTable({ players, teamName, winTeam, version }) {
  const isWinner = winTeam === teamName;
  const sorted = [...players].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-white/5 ${isWinner ? 'bg-green-900/10' : ''}`}>
        <span className={`font-bold text-sm ${isWinner ? 'text-green-400' : 'text-gray-300'}`}>{teamName}</span>
        {isWinner && (
          <span className="text-xs bg-green-400/10 text-green-400 border border-green-400/20 px-2 py-0.5 rounded-full">
            VICTORY
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-600 text-xs border-b border-white/5">
              <th className="text-left px-3 py-2">Player</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">KDA</th>
              <th className="px-3 py-2">Gold</th>
              <th className="px-3 py-2">CS</th>
              <th className="px-3 py-2">Dmg</th>
              <th className="text-left px-3 py-2">Items</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <PlayerRow key={i} player={p} version={version} isWinner={isWinner} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MatchDetailPage() {
  const { gameId } = useParams();
  return <MatchContent key={gameId} gameId={gameId} />;
}

function MatchContent({ gameId }) {
  const [tab, setTab] = useState('preview');
  const { version, champions } = useDDragon();
  const { matches, loading, error } = useMatchData({ limit: 200, expand_series: 'true' });
  const match = matches.find((item) => item.game_id === gameId);
  const games = useMemo(() => {
    if (!match) return [];
    return matches.filter((item) => item.game_id === match.game_id || (match.match_id && item.match_id === match.match_id && item.tournament === match.tournament))
      .sort((a, b) => (Number(a.game_number) || 0) - (Number(b.game_number) || 0) || new Date(a.datetime_utc) - new Date(b.datetime_utc)).slice(0, 5);
  }, [matches, match]);
  const setIndex = tab.startsWith('set-') ? Number(tab.slice(4)) - 1 : -1;
  const selectedGame = games.some(game => game.game_number) ? games.find(game => Number(game.game_number) === setIndex + 1) : games[setIndex];
  const { stats, loading: statsLoading, error: statsError } = useMatchStats(selectedGame?.game_id);
  const draft = useMatchDraft(selectedGame?.game_id);
  const teams = [games[0]?.team1, games[0]?.team2];
  const activeTab = MATCH_TABS.find((item) => item.id === tab);
  const selectWithKeyboard = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % MATCH_TABS.length;
    if (event.key === 'ArrowLeft') next = (index + MATCH_TABS.length - 1) % MATCH_TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = MATCH_TABS.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setTab(MATCH_TABS[next].id);
    const nextTab = event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next];
    nextTab.focus();
    nextTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return <div className="match-detail-page">
    <Link className="match-back-link" to="/">← 경기 목록으로</Link>
    <header className="match-series-header">
      <span className="eyebrow">MATCH CENTER / {match?.tournament || '경기 상세'}</span>
      <h1>{teams[0] || '팀 정보 대기'} <span>VS</span> {teams[1] || '팀 정보 대기'}</h1>
      <p>{match ? formatDate(match.datetime_utc) : '경기 기록이 연결되면 대회·날짜·대진이 표시됩니다.'}</p>
    </header>
    <div className="match-section-tabs" role="tablist" aria-label="경기 상세 구분">
      {MATCH_TABS.map((item, index) => <button type="button" key={item.id} role="tab" id={`tab-${item.id}`} aria-controls="match-tab-panel" aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={(event) => selectWithKeyboard(event, index)} onClick={() => setTab(item.id)}>{item.label}{item.detail && <small>{item.detail}</small>}</button>)}
    </div>
    <section className="match-tab-panel" id="match-tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
      <div className="match-panel-heading"><div><span className="eyebrow">{tab === 'preview' ? 'BEFORE THE MATCH' : tab === 'summary' ? 'MATCH RECAP' : `GAME ${setIndex + 1}`}</span><h2>{activeTab.label}{tab === 'preview' ? ' · 경기 전' : tab === 'summary' ? ' · 경기 전체 돌아보기' : ' · 경기 기록'}</h2></div></div>
      {loading && <LoadingSpinner message="경기 정보를 불러오고 있습니다." />}
      {error && <ErrorMessage message="경기 데이터를 불러오지 못했습니다." />}
      {tab === 'preview' && <>
        <p className="match-section-description">경기 전 확인할 대진과 팀 정보를 모아보는 공간입니다.</p>
        <div className="match-preview-grid">{['출전 팀 · 로스터', '최근 경기 · 상대 전적', '경기 전 관전 포인트'].map((title) => <div className="match-info-card" key={title}><h3>{title}</h3><p>관련 데이터가 연결되면 표시됩니다.</p></div>)}</div>
      </>}
      {setIndex >= 0 && <>
        {selectedGame && <div className="match-set-overview"><span>승리 팀 <strong>{selectedGame.win_team || '결과 미확인'}</strong></span><span>경기 시간 <strong>{formatGameLength(selectedGame.gamelength_number)}</strong></span><span>패치 <strong>{selectedGame.patch || '—'}</strong></span></div>}
        <TournamentDraft key={selectedGame?.game_id || `draft-${setIndex}`} game={selectedGame} draft={draft} players={stats} version={version} champions={champions} setNumber={setIndex + 1} preview={gameId === 'layout-preview'} loading={loading || draft.state === 'loading'} />
        <AiMatchSummary key={selectedGame?.game_id || `empty-${setIndex}`} gameId={selectedGame?.game_id} scope="game" setNumber={setIndex + 1} available={Boolean(selectedGame && [selectedGame.team1, selectedGame.team2].includes(selectedGame.win_team))} loading={loading} dataError={error} />
        {!loading && !selectedGame && <div className="match-section-empty"><strong>{setIndex + 1}세트 기록이 없습니다.</strong><p>경기 진행 여부와 세트 기록이 확인되면 표시됩니다.</p></div>}
        {selectedGame && <>
          <h3 className="match-stats-heading">선수별 기록</h3>
          {statsLoading && <LoadingSpinner message="선수 기록을 불러오고 있습니다." />}
          {statsError && <ErrorMessage message="선수 기록을 불러오지 못했습니다." />}
          {!statsLoading && !statsError && !stats.length && <div className="match-section-empty">선수 기록이 아직 연결되지 않았습니다.</div>}
          {!statsLoading && !statsError && stats.length > 0 && <div className="match-player-tables">{stats.some((player) => player.team) ? [selectedGame.team1, selectedGame.team2].map((team) => <TeamTable key={team} teamName={team} players={stats.filter((player) => player.team === team)} winTeam={selectedGame.win_team} version={version} />) : <TeamTable players={stats} teamName="전체 선수 기록 · 팀 정보 미확인" version={version} />}</div>}
        </>}
      </>}
      {tab === 'summary' && <MatchSummary games={games} match={match} gameId={gameId} loading={loading} error={error} onSelectSet={(index) => {
        setTab(`set-${index + 1}`);
        document.getElementById(`tab-set-${index + 1}`)?.focus();
      }} />}
    </section>
  </div>;
}

