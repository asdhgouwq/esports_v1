import { Link } from 'react-router-dom';
import WorldsHub from '../components/WorldsHub';
export default function SchedulePage() {
  return <div className="stats-dashboard"><Link className="match-back-link" to="/">← 메인으로</Link><WorldsHub /></div>;
}
