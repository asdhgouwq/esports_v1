import '../styles/worlds-hero.css';

export default function WorldsHero() {
  return <header className="worlds-hero">
    <div className="worlds-hero-kicker">
      <span><i aria-hidden="true" />2026 WORLD CHAMPIONSHIP</span>
      <span className="worlds-hero-edition">LEAGUE OF LEGENDS</span>
    </div>
    <h1 className="worlds-hero-title" aria-label="WORLDS 26">
      <span>WORLDS</span><span>26</span>
    </h1>
    <div className="worlds-hero-footer">
      <div><p className="worlds-hero-tagline">세계 정상으로 향하는 승부.</p><p className="worlds-hero-description">플레이인부터 결승까지, 일정과 경기 기록을 한곳에서.</p></div>
      <nav className="worlds-hero-actions" aria-label="월즈 바로가기">
        <a href="#worlds-fixtures">일정 · 결과 <span aria-hidden="true">↓</span></a>
        <a href="#worlds-game-records">세트 기록 <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </header>;
}
