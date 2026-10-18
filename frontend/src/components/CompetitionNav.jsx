import { Link } from 'react-router-dom';
import { COMPETITION_GROUPS, competitionPath } from '../config/competitions';
import '../styles/competitions.css';

export default function CompetitionNav({ selected = '' }) {
  return (
    <nav className="competition-page-nav" aria-label="지역별 리그 및 국제 대회">
      <Link to="/" aria-current={!selected ? 'page' : undefined}>
        {selected ? '← 메인으로' : '전체 경기'}
      </Link>
      {COMPETITION_GROUPS.map((group) => (
        <div className="competition-nav-group" key={group.id} role="group" aria-label={group.label}>
          {group.competitions.map((competition) => (
            <Link key={competition.id} to={competitionPath(competition.id)} aria-current={selected === competition.id ? 'page' : undefined} title={`${group.label} · ${competition.description}`}>
              {competition.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
