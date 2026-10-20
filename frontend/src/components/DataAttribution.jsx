import {Link} from 'react-router-dom';
import '../styles/data-attribution.css';
import {CC_LICENSE,leaguepediaArticle} from '../lib/dataSources';
export function MatchAttribution({game}) {
 const article = leaguepediaArticle(game?.game_id);
 if (!game) return null;
 return <p className="match-attribution">경기·밴픽·선수 기록: <a href={article?.url || 'https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki'} target="_blank" rel="noreferrer">Leaguepedia{article ? ` · ${article.title}` : ''}</a> 및 기여자 · <a href={CC_LICENSE} target="_blank" rel="license noreferrer">CC BY-SA 3.0</a> · dol.gg에서 정규화·집계 <Link to="/data-sources">출처 안내 ↗</Link></p>;
}
export default function DataAttribution() {
 return <footer className="site-attribution" aria-label="데이터 출처 및 권리 안내"><div className="site-attribution-top"><Link to="/" className="site-attribution-brand">dol<span>.gg</span></Link><Link to="/data-sources">데이터 출처·이용 안내 ↗</Link></div>
 <p>경기 데이터: <a href="https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki" target="_blank" rel="noreferrer">Leaguepedia 및 기여자</a> · <a href={CC_LICENSE} target="_blank" rel="license noreferrer">CC BY-SA 3.0</a> · dol.gg에서 가공</p>
 <p className="riot-disclaimer" lang="en">Date Of Legends isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.</p>
 </footer>;
}
