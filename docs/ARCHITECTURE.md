# dol.gg - 아키텍처 문서

## 📁 프로젝트 구조

```
esports_v1/
├── index.html                    # 진입점 (HTML 뼈대만)
├── src/
│   ├── styles/                   # CSS (완전 분리)
│   │   ├── base.css              # 리셋, 변수, 글로벌
│   │   ├── layout.css            # 레이아웃
│   │   ├── components.css        # 컴포넌트
│   │   ├── report.css            # 리포트 스타일
│   │   ├── draft.css             # 드래프트 보드
│   │   ├── charts.css            # 차트
│   │   └── responsive.css        # 반응형
│   │
│   └── js/
│       ├── config/
│       │   └── constants.js      # 팀, 리그, 상수
│       │
│       ├── data/                 # 📊 데이터 레이어
│       │   ├── rosters.js        # 팀 로스터
│       │   ├── matches.js        # 경기 데이터
│       │   ├── standings.js      # 순위 데이터
│       │   ├── news.js           # 뉴스
│       │   └── reports.js        # AI 분석 리포트
│       │
│       ├── api/                  # 🔌 API 계층 (나중에 추가)
│       │   ├── client.js         # Fetch 래퍼
│       │   └── endpoints.js      # 엔드포인트
│       │
│       ├── utils/                # 🛠️ 유틸 함수
│       │   ├── date.js           # 날짜 포맷팅
│       │   ├── format.js         # 숫자/텍스트 포맷팅
│       │   └── dom.js            # DOM 조작
│       │
│       ├── components/           # 🎨 UI 컴포넌트 (렌더 함수)
│       │   ├── match-card.js
│       │   ├── standings-table.js
│       │   ├── team-card.js
│       │   ├── draft-board.js
│       │   ├── ai-report.js
│       │   └── chart.js
│       │
│       ├── views/                # 📄 페이지 로직
│       │   ├── home.js
│       │   ├── schedule.js
│       │   ├── standings.js
│       │   ├── teams.js
│       │   └── analysis.js
│       │
│       ├── state/                # 💾 전역 상태
│       │   └── store.js          # 상태 관리
│       │
│       └── main.js               # ⚙️ 앱 진입점
│
└── docs/
    ├── ARCHITECTURE.md           # 이 파일
    └── FILE-STRUCTURE.md         # 파일별 설명
```

---

## 🎯 계층별 책임

### **Data 레이어** (`src/js/data/`)
- **책임**: 데이터 저장 및 쿼리
- **예시**: `getMatchById()`, `getRoster()`, `getReport()`
- **주의**: 순수 데이터만, 렌더링 없음
- **나중 변경**: API 호출로 교체만 하면 됨

### **API 계층** (`src/js/api/`)  *(아직 미구현)*
- **책임**: 서버 통신 추상화
- **향후 추가**: `fetchMatches()`, `fetchStandings()` 등
- **설계**: Data 레이어와 분리 → 나중에 API 호출 전환 용이

### **Utils 레이어** (`src/js/utils/`)
- **책임**: 재사용 가능한 함수
- **예시**: 날짜 포맷팅, DOM 조작, 숫자 포맷팅
- **특징**: 순수 함수, 의존성 없음

### **Components 레이어** (`src/js/components/`)  *(아직 미구현)*
- **책임**: 순수 렌더 함수 (HTML 반환)
- **패턴**: `renderMatchCard(match) → HTML 문자열`
- **장점**: React/Vue 전환 시 쉽게 JSX로 변환 가능
- **특징**: 부작용 없음, 테스트 용이

### **Views 레이어** (`src/js/views/`)  *(아직 미구현)*
- **책임**: 페이지 로직 (데이터 fetch → 필터링 → 렌더)
- **패턴**:
  ```js
  // src/js/views/schedule.js
  export function renderScheduleView() {
    const matches = getMatches();           // 데이터 가져오기
    const filtered = filterByLeague(matches);
    const grouped = groupByDate(filtered);
    // 렌더링
  }
  ```

### **State 레이어** (`src/js/state/`)
- **책임**: 전역 상태 관리
- **관리**: 테마, 현재 뷰, 필터, 선택 아이템
- **패턴**: Observer 패턴 (상태 변경 시 리스너 호출)

---

## 🔄 데이터 흐름

```
User Click
    ↓
View (schedule.js)
    ↓
Data Layer (matches.js) → API Layer (client.js, 나중에)
    ↓
Utils (date.js, format.js)
    ↓
Components (match-card.js)
    ↓
Render to DOM
```

### 예시: "일정 보기" 클릭 시
1. **네비 클릭** → `setActiveView('schedule')`
2. **State 변경** → `store.setView('schedule')` 발생
3. **View 렌더** → `renderScheduleView()` 호출
4. **Data 쿼리** → `getMatches()` 호출
5. **필터링** → `filterByLeague()`, `groupByDate()`
6. **렌더링** → `renderMatchCard()` 호출
7. **DOM 업데이트** → `section#view-schedule` 채우기

---

## 🔌 API 레이어 (나중에 추가)

현재는 샘플 데이터를 사용하지만, 나중에 실제 API 연동 시:

```js
// src/js/api/client.js (새로 작성)
export async function fetchMatches(filters) {
  const response = await fetch('/api/matches', {
    params: filters
  });
  return response.json();
}

// src/js/data/matches.js (수정 필요)
// import * as api from '../api/client.js';
// getMatches() → api.fetchMatches()로 교체
```

**장점**: Data 레이어와 API 계층을 분리하면, API 교체 시 다른 코드는 변경 안 함!

---

## ✅ 수정 시 어디를 봐야 하나?

| 문제 | 해결 위치 |
|------|---------|
| 경기 카드 UI 깨짐 | `src/styles/components.css` + `src/js/components/match-card.js` |
| 경기 데이터 오류 | `src/js/data/matches.js` |
| 날짜 포맷 이상 | `src/js/utils/date.js` |
| 골드 차트 안 뜸 | `src/styles/charts.css` + `src/js/components/chart.js` |
| AI 분석 텍스트 오류 | `src/js/data/reports.js` |
| 테마 토글 안 됨 | `src/js/state/store.js` |
| 레이아웃 깨짐 | `src/styles/layout.css` + `src/styles/responsive.css` |

---

## 📈 다음 단계

### Phase 1: 컴포넌트 완성
- [ ] `src/js/components/` 구현 (match-card, standings-table 등)
- [ ] 각 컴포넌트가 순수 HTML 반환하도록

### Phase 2: Views 완성
- [ ] `src/js/views/` 구현 (home, schedule, standings 등)
- [ ] 각 View에서 데이터 fetch → 필터 → 렌더

### Phase 3: API 연동
- [ ] `src/js/api/` 구현
- [ ] `src/js/data/` 의 각 함수를 API 호출로 교체

### Phase 4: 상태 관리 고도화
- [ ] Redux/Zustand 같은 라이브러리 도입 (선택사항)
- [ ] 복잡한 상태 흐름 관리

---

## 🏗️ 설계 원칙

1. **관심사의 분리** — 각 레이어는 한 가지만 담당
2. **재사용성** — 유틸과 컴포넌트는 독립적으로 테스트 가능
3. **점진적 마이그레이션** — 한 번에 한 레이어씩 개선
4. **의존성 단방향** — View → Components → Utils (역방향 X)
5. **나중 교체 가능** — API, 라이브러리 변경 시 다른 코드 영향 없음
