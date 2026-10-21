import {useState} from 'react';
import {teamLogoUrl} from '../lib/teamLogos';
import '../styles/team-identity.css';

export function TeamLogo({name, eager = false}) {
  const src = teamLogoUrl(name);
  const [failed, setFailed] = useState(null);
  if (!src || failed === src) return null;
  return <span className="team-logo" aria-hidden="true"><img src={src} alt="" width="32" height="32" loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(src)} /></span>;
}

export default function TeamIdentity({name, logoSide = 'start', className = '', eager = false}) {
  return <span className={`team-identity${logoSide === 'end' ? ' team-identity-logo-end' : ''}${className ? ` ${className}` : ''}`}><TeamLogo name={name} eager={eager} /><span className="team-identity-name">{name || '팀 정보 대기'}</span></span>;
}
