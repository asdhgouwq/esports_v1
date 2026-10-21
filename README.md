# dol.gg — e스포츠 정보 플랫폼

> League of Legends 리그 정보, 팀, 선수, 경기 분석을 한눈에 제공하는 플랫폼

## 개발 환경

현재 실행 앱은 `frontend/`의 React/Vite 화면과 `backend/`의 Express 서버입니다.
연결과 기기 이전 절차는 [작업 인수인계 문서](docs/HANDOFF.txt)를 참고하세요.

- 경기 전체 총평과 세트별 AI 요약, 로컬 ChatGPT 구독 연결
- 실제 진영과 픽 순서를 구분하는 토너먼트 밴픽, 진영·픽 순서 선택 팀 표시와 선수별 통계
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

## 데이터와 설정

### 월즈 유충·전령 카운트

- ChainCC의 [무료 팀별 CSV](https://chaincc.lol/free/data)에서 최종 수량을 가져옵니다. 경기 날짜·세트·실제 진영·챔피언 10명·승패·골드·킬을 Leaguepedia 저장 기록과 대조해 유일하게 일치한 세트만 적용합니다. 누락은 `—`로 유지하며 처치 시각을 추정하지 않습니다.
- `WORLDS_AUTO_SYNC=true`이면 서버 시작과 월즈 저장 완료 후, 그리고 `WORLDS_SYNC_INTERVAL_MINUTES` 주기(기본 15분)에 자동 갱신합니다. CSV는 1시간 캐시하고 요청 제한과 재시도 간격을 지킵니다. 원본 공개가 늦으면 다음 갱신에서 반영됩니다.
- 검증 결과는 Git 추적 대상인 `backend/data/objectives/worlds-2026.json`에 저장합니다. 원본 캐시는 `backend/.cache/chaincc/`이며 Git에서 제외합니다. 원본 조회 실패 시 기존 검증 결과를 유지합니다. Supabase 스키마 변경은 없습니다.
- `GET /api/matches/:gameId/timeline`의 `objectiveTotals`에 카운트와 출처를 함께 제공합니다. 골드 타임라인이 없어도 사용 가능합니다. `GET /api/worlds/objectives/status`, 로컬 Origin·JSON 검사를 통과한 `POST /api/worlds/objectives/sync`로 상태 조회와 즉시 재확인이 가능합니다.
- 오브젝트 영역·공통 하단·`/data-sources`에 ChainCC, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), 경기 대조·집계 사실을 표시합니다. 최종 수량은 타임라인 이벤트나 처치 시점으로 변환하지 않습니다.

### 개발용 월즈 타임라인 (무료 공개 피드 확인: 2026-10-20)

공식 LoL Esports 공개 일정에서 2026 월즈 종료 22세트의 정확한 경기 ID를 확인했고, 모두 무료 LiveStats 첫 구간을 조회했습니다. 전체 경기 기록은 순차 수집 후 검증을 통과한 세트부터 표시합니다. 별도 API 키나 유료 계약 없이 조회됐지만, 정식 개발자용 API 계약은 아니며 향후 공개 범위·보관 기간·형식은 보장되지 않습니다. 발표용 별도 배포본에는 이 변경이 자동 반영되지 않습니다.

- `GET /api/matches/:gameId/timeline`: 검증한 세트의 골드 추이와 킬·용·바론·포탑·억제기 이벤트. 수집·재시도·원본 대기·검증 실패 상태를 구분합니다. 화면 주요 이벤트는 용·바론·첫 킬·첫 포탑으로 정리하며, 유충·전령은 원본에 없으면 표시하지 않습니다.
- 선수 10명의 챔피언, 원본 경기 ID, 종료 기록, 최종 골드·킬, 프레임 연속성을 검증한 뒤 `backend/data/timelines/`에 정규화한 공개 기록을 저장합니다. 이 파일은 Git 추적 대상이므로 다른 개발 컴퓨터에서도 사용할 수 있습니다. Supabase에 별도 타임라인 테이블을 만들지는 않습니다.
- `WORLDS_AUTO_SYNC=true`이면 서버 시작 시와 기존 경기 갱신 후 종료 세트의 경기 흐름도 자동 확인합니다. `WORLDS_TIMELINE_AUTO_SYNC=false`로 경기 흐름 수집만 끌 수 있습니다. 작업 중복을 방지하고, 검증된 저장본은 재사용합니다. 이 Mac의 백엔드가 실행되는 동안 동작합니다.
- 원본 응답과 공식 일정은 Git에서 제외한 `backend/.cache/lolesports/`에 보관합니다. 화면이나 AI 요청은 외부 피드를 매번 재수집하지 않습니다. 중단 후에도 저장한 구간부터 이어받으며, 요청 제한은 전체 수집을 대기시킵니다. 미제공 원본과 수치 불일치는 임의로 보완하지 않습니다.
- 수집 상태는 `backend/.local/worlds-sync/timelines/status.json`에 보관합니다. `GET /api/worlds/timelines/status`에서 진행 수치를 확인하고, 로컬 Origin·JSON 검사를 통과한 `POST /api/worlds/timelines/sync`로 즉시 재확인할 수 있습니다. 세트별 재시도 시각과 피드 요청 제한은 수동 요청에도 유지됩니다.
- 시간은 피드 경과 기준으로 게임 시계와 수초 차이가 있습니다. 명시적인 일시정지·재개로 확인된 구간만 제외하며, 그 외 프레임 누락과 최종 경기 시간 불일치는 거부합니다. 골드는 약 10초 간격으로 표시하고 이벤트는 원본 프레임 증감에서 추출합니다. 선수 위치·경험치·유충·바론 스틸 원자료가 없어 해당 내용은 추측하지 않습니다. 동시 킬·사망을 임의로 짝짓지 않습니다.
- AI 요약은 해당 세트의 이벤트·5분 단위 골드와 기존 최종 기록을 함께 사용합니다. 다른 세트에 타임라인이 있다고 가정하지 않습니다.

저장본을 다시 수집하고 기존 경기 기록과 검증하려면 `backend` 폴더에서 실행합니다. Supabase 서버 전용 키는 기존 `backend/.env`를 사용합니다.

```sh
node scripts/import-worlds-timeline.js
```

개발 화면: `/match/2026%20Season%20World%20Championship%2FPlay-In_Round%201_1_1`의 **1세트** 탭.

### AI 요약 사용량 설정

- 모델은 `gpt-6-luna`, 추론 강도는 `low`로 고정하며 화면의 모델 선택 칸은 제거했습니다. 연결된 구독에서 해당 모델을 사용할 수 없으면 다른 모델로 자동 전환하지 않습니다.
- 요청당 출력 상한은 추론을 포함해 2,000토큰입니다. 미완성 응답은 저장하지 않습니다.
- 모든 타임라인 사건과 골드 지표를 유지하면서 반복 식별자·원본 메타데이터를 요청에서 줄입니다. 검증은 압축 전 원본 수치·시점으로 수행하며, 검증 실패 시 한 번만 교정 요청합니다.
- 동일 계정·모델·원본 기록의 완성된 요약을 재사용합니다. 설정 변경 전 캐시는 새 요청에 사용하지 않습니다.

### 데이터 출처·이용 조건 확인 (2026-10-20)

- `/data-sources`에서 데이터별 출처, 가공 방식, 라이선스와 확인되지 않은 조건을 안내합니다. 모든 화면 하단에 Leaguepedia 기여자·라이선스와 Riot 비공식 서비스 안내를 표시합니다. 경기 상세에는 관련 Leaguepedia 대회 문서 링크를 제공합니다.
- Leaguepedia의 원본 및 이를 기반으로 가공한 기록: [Leaguepedia 저작권 안내](https://lol.fandom.com/wiki/Leaguepedia:Copyrights), [Fandom 라이선스](https://www.fandom.com/licensing), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). 원본·기여자·라이선스·변경 사실을 표시하고 해당 파생 콘텐츠에도 동일 조건을 적용합니다. 사이트 코드, Riot 이미지, 별도 피드에 이 라이선스를 일괄 적용하지 않습니다.
- LiveStats의 공개 응답은 수집 가능함을 확인했지만, 해당 window/details 경로의 저장·재배포를 명시적으로 허용하는 전용 조건은 찾지 못했습니다. 일반 개발자 API 키/약관이 이 경로의 이용 허가라고 간주하지 않습니다. 출처 표시만으로 이용 허가가 생기지 않습니다. 상시 공개 운영·상업적 배포 전에는 Riot/제공자의 조건과 필요한 권한을 확인해야 합니다. 이 변경은 재배포 허가를 확보한 것이 아닙니다.
- 확인한 공식 자료: [Riot e스포츠 데이터 및 GRID 안내](https://riotesportsdata.com/en-us/league-of-legends/), [개발자 정책](https://developer.riotgames.com/policies/general), [API 약관](https://developer.riotgames.com/terms), [Riot 이용 약관](https://www.riotgames.com/en/terms-of-service), [팬 프로젝트 정책](https://www.riotgames.com/en/legal).
- 비교 조사: [OP.GG e스포츠](https://esports.op.gg/)와 [gol.gg 공개 페이지](https://gol.gg/champion/champion-builds/165/season-ALL/split-ALL/tournament-LCS%202026%20Spring/)는 Riot 비공식 서비스·상표권 안내를 표시합니다. 확인한 화면만으로 데이터 공급 계약·재배포 권한은 판단할 수 없습니다. dol.gg는 두 사이트를 자동 수집하지 않습니다.
- 현재 적용 대상은 원본 개발 사이트입니다. 별도 발표용 배포 사이트는 이번 변경에서 갱신하지 않았습니다.

### 선수별 룬·스펠·아이템

- `GET /api/matches/:gameId/loadouts`: Leaguepedia `ScoreboardPlayers`의 핵심 룬·주/부 계열·스펠 2개·최종 아이템 6칸·장신구·포지션 퀘스트 슬롯(`RoleBoundItem`)을 조회합니다. 기존 선수 기록 10명의 경기 ID·선수명·팀·챔피언을 대조한 후에만 표시합니다.
- 검증된 장비 기록은 `backend/data/player-loadouts/`에 보관합니다. 기존 Supabase 스키마를 변경하지 않고 별도 기록을 결합하므로 `backend/.env`와 Leaguepedia Bot 연결은 기존 방식대로 사용합니다. 기록이 없는 세트는 최초 조회 시 소스의 캐시와 요청 간격을 따릅니다.
- Data Dragon의 룬·스펠·아이템 메타데이터로 실제 아이콘을 연결합니다. 아이템명으로 오는 값과 슬롯의 빈 칸을 보존하며, 미확인 항목을 임의 아이콘으로 대체하지 않습니다. 표에는 챔피언·선수·포지션, 핵심 룬/부룬 계열, 스펠, KDA, 피해량 막대, CS, 골드, 아이템과 맨 오른쪽 퀘스트 슬롯을 표시합니다. 피해량은 별도 카드 대신 선수 표에 통합하며 모든 선수에 같은 최대값 눈금을 사용합니다. 장비 캐시 버전 2부터 퀘스트 필드를 포함합니다. 정글 퀘스트 슬롯은 검증된 LiveStats 아이템 ID로 확인한 빨강·파랑·초록 정글펫 아이콘을 표시합니다. Leaguepedia의 공통 보상 이름만으로 색상을 추측하지 않으며, 미확인 기록은 ?로 표시합니다.

## 검증

```sh
npm test --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

서버는 로컬 루프백에서만 실행하며 쓰기 요청은 허용한 로컬 화면의 JSON 요청만 받습니다. `.env`와 로그인 저장소는 Git에서 제외합니다. 이 설정을 그대로 외부 공개 서버에 사용하지 마세요.

## 라이선스

Private Project (2026). 데이터와 이미지의 권리는 위 출처 안내에 따릅니다.
