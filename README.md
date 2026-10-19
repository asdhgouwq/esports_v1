# dol.gg — e스포츠 정보 플랫폼

> League of Legends 리그 정보, 팀, 선수, 경기 분석을 한눈에 제공하는 플랫폼

## 최신 작업 상태 · 2026-10-19

현재 실행 앱은 `frontend/`의 React/Vite 화면과 `backend/`의 Express 서버입니다.
아래의 기존 정적 웹 설계보다 [작업 인수인계 문서](docs/HANDOFF.txt)를 우선 참고하세요.

- 경기 전체 총평과 세트별 AI 요약, 로컬 ChatGPT 구독 연결
- 실제 선택 순서가 표시되는 토너먼트 밴픽과 선수별 통계
- Leaguepedia Bot 인증·공유 요청 큐·캐시·요청 제한 대기
- Supabase 서버 저장 및 2026 월즈 일정·종료 경기 자동 수집
- 월즈 일정/결과 필터, 세트 상세 연결, 타이포그래피 배너

로컬 실행은 각 폴더에서 `npm ci` 후, `backend/`에서 `npm start`,
`frontend/`에서 `npm run dev`를 실행합니다.
설정 파일은 각 폴더의 `.env.example`을 참고해 생성하세요.
월즈 저장 스키마 변경은 `backend/migrations/20261019_worlds_sync.sql`에 있습니다.

`.env`, 서버 키, Bot Password, ChatGPT 로그인 정보 및 로컬 캐시는 Git에 포함되지 않습니다.
새 기기에서는 연결을 다시 설정해야 하며, 경기 데이터는 기존 Supabase 프로젝트에 보관됩니다.
자동 수집은 로컬 서버가 실행되고 Mac이 깨어 있는 동안 동작합니다.

검증: backend 52개 테스트, frontend 14개 테스트 및 프로덕션 빌드 통과.

---

아래 내용은 초기 정적 웹 버전의 설계 기록입니다.

## 📺 현재 상태

- ✅ UI/UX 완성 (다크/라이트 테마, 반응형)
- ✅ 모듈화 아키텍처 (관심사 분리)
- ✅ 샘플 데이터 구조 설계
- ⏳ 컴포넌트 렌더 함수 (진행 중)
- ⏳ 뷰 레이어 (진행 중)
- ❌ 실제 API 연동 (예정)

## 🎯 핵심 기능

### 1. 홈 화면
- 오늘의 LIVE 경기
- AI 분석 하이라이트
- 리그 순위 요약
- 최신 뉴스

### 2. 일정 · 결과
- 리그별 필터 (LCK, LPL, LEC)
- 예정/진행중/결과 탭
- 날짜별 경기 그룹핑

### 3. 순위표
- 레전드/라이즈 그룹
- 승률, 세트 득실, 연승, 최근 폼

### 4. 팀 & 선수
- 팀 카드 및 로스터
- 선수별 KDA, 통계

### 5. AI 경기 분석 ⭐
- 시리즈 종합 평가
- **세트별 상세 분석**:
  - 골드 타임라인 차트
  - 초반/중반/후반 국면 분석
  - 승부처 (골드 스윙 기준)
  - 밴픽 드래프트 보드
  - 선수 평점

---

## 🏗️ 폴더 구조

```
src/js/
├── config/          # 상수 (팀, 리그, 포지션)
├── data/            # 데이터 레이어 (샘플 데이터)
├── api/             # API 계층 (추후 추가)
├── utils/           # 유틸 함수 (날짜, 포맷팅, DOM)
├── components/      # 렌더 컴포넌트 (진행 중)
├── views/           # 페이지 로직 (진행 중)
├── state/           # 전역 상태 관리
└── main.js          # 앱 진입점

src/styles/         # CSS (7개 파일로 분리)
```

**자세한 설명은 `docs/ARCHITECTURE.md` 참고**

---

## 🚀 사용 방법

### 로컬 실행
```bash
# 간단한 HTTP 서버 (Python)
python -m http.server 8000

# 또는 Node.js
npx http-server
```

그 후 `http://localhost:8000` 접속

### 모듈 임포트
```js
// 데이터
import { TEAMS } from './data/teams.js';
import { getMatches } from './data/matches.js';

// 유틸
import { formatGold, formatDuration } from './utils/format.js';
import { $ } from './utils/dom.js';

// 상태
import { store } from './state/store.js';
```

---

## 📝 개발 가이드

### 경기 카드 렌더링 추가
```js
// src/js/components/match-card.js (아직 미구현)
export function renderMatchCard(match) {
  return `
    <div class="match">
      <div class="match-time">${match.time}</div>
      <div class="match-teams">
        <div class="mt-row">${match.a}</div>
        <div class="mt-row">${match.b}</div>
      </div>
    </div>
  `;
}
```

### 일정 뷰 렌더링
```js
// src/js/views/schedule.js (아직 미구현)
export function renderScheduleView() {
  const matches = getMatches();
  const grouped = groupByDate(matches);
  
  grouped.forEach(({ date, items }) => {
    const html = items
      .map(m => renderMatchCard(m))
      .join('');
    // DOM 업데이트
  });
}
```

### 상태 구독
```js
// 테마 변경 감지
store.on('change', ({ path, value }) => {
  if (path === 'theme') {
    console.log('테마 변경:', value);
  }
});

// 필터 변경
store.setFilter('league', 'LPL');
```

---

## 🔄 다음 순서

### Week 1: 렌더 함수 구현
- [ ] `components/match-card.js`
- [ ] `components/standings-table.js`
- [ ] `components/team-card.js`
- [ ] `components/draft-board.js`
- [ ] `components/ai-report.js`

### Week 2: 뷰 로직 구현
- [ ] `views/home.js`
- [ ] `views/schedule.js`
- [ ] `views/standings.js`
- [ ] `views/teams.js`
- [ ] `views/analysis.js`

### Week 3-4: API 연동 + 실데이터
- [ ] `api/client.js` 작성
- [ ] Riot Games API 또는 크롤링 파이프라인 구축
- [ ] 데이터 레이어 API 호출로 교체

---

## 💾 데이터 구조

### Match (경기)
```js
{
  id: "m201",           // 경기 ID
  league: "LCK",        // 리그
  stage: "라운드 4",     // 스테이지
  date: "2026-07-25",   // 경기 날짜
  time: "20:00",        // 경기 시간
  a: "T1", b: "GEN",    // 팀 코드
  sa: 2, sb: 1,        // 세트 스코어
  status: "done",       // upcoming | live | done
  featured: true        // 특집 경기 여부
}
```

### Report (AI 분석)
```js
{
  series: {             // 시리즈 종합
    headline: "...",
    summary: "...",
    confidence: 88,
    mvp: "Keria"
  },
  games: [              // 세트별 분석
    {
      set: 1,
      winner: "GEN",
      gold: [[0,0], [3,-180], ...],  // 분당 골드 차이
      phases: [...],    // 초반/중반/후반 분석
      moments: [...],   // 승부처
      banpick: {...},   // 밴픽 분석
      ratings: [...]    // 선수 평점
    }
  ]
}
```

**자세한 스키마는 `docs/DATA-SCHEMA.md` 참고** *(아직 작성 안 함)*

---

## 🐛 문제 해결

### "샘플 데이터만 보임"
→ API가 아직 구현되지 않았습니다. `src/js/data/` 의 샘플 데이터를 사용하고 있습니다.

### "경기 카드가 렌더링 안 됨"
→ `src/js/views/` 가 아직 미구현입니다. Week 1-2 에서 작업 예정.

### "테마 토글이 안 됨"
→ 브라우저 콘솔을 확인하세요. `src/js/main.js` 에서 에러 메시지를 볼 수 있습니다.

---

## 📚 참고 자료

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — 아키텍처 및 계층 설명
- [FILE-STRUCTURE.md](docs/FILE-STRUCTURE.md) — 파일별 상세 설명 *(아직 작성 안 함)*

---

## 🤝 기여 가이드

1. **새 파일 작성 시** — `src/js/` 의 폴더 구조 따르기
2. **데이터 추가 시** — `src/js/data/` 에 추가, export 함수 작성
3. **UI 수정 시** — `src/styles/` 의 해당 CSS 파일 수정
4. **테스트** — 브라우저 콘솔에서 `import` 테스트 후 커밋

---

## 📄 라이선스

Private Project (2026)
