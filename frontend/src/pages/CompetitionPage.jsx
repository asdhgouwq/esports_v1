import { useEffect } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { COMPETITION_GROUPS, COMPETITIONS, competitionPath } from '../config/competitions';
import HomePage from './HomePage';

export function HomeEntry() {
  const [params] = useSearchParams();
  const legacy = COMPETITIONS.find((item) => item.id === params.get('competition'));
  return legacy ? <Navigate to={competitionPath(legacy.id)} replace /> : <HomePage />;
}

export default function CompetitionPage({ groupId }) {
  const { competitionId } = useParams();
  const group = COMPETITION_GROUPS.find((item) => item.id === groupId);
  const competition = group?.competitions.find((item) => item.id === competitionId);

  useEffect(() => {
    document.title = competition ? `${competition.label} — dol.gg | Date of Legends` : '대회를 찾을 수 없습니다 — dol.gg';
    window.scrollTo(0, 0);
    return () => { document.title = 'dol.gg — Date of Legends'; };
  }, [competition]);

  if (!competition) return <div className="stats-dashboard"><h1>리그 또는 대회를 찾을 수 없습니다.</h1><Link to="/">메인으로 돌아가기</Link></div>;
  return <HomePage key={competition.id} competition={competition} group={group} />;
}
