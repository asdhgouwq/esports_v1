/**
 * RIFT.GG - AI Match Reports Data
 *
 * 데이터 구조:
 * REPORTS[matchId] = {
 *   series: { 시리즈 종합 분석 },
 *   games: [ { set:1, 세트별 상세 분석 }, ... ]
 * }
 *
 * 실제 데이터는 src/data/reports-data.js에 분리됨
 */

// ⚠️ 주의: 실제 리포트 데이터는 reports-data.js에서 임포트됨
// import { REPORTS_DATA } from './reports-data.js';

export const REPORTS = {};

/**
 * 특정 경기의 AI 분석 리포트 조회
 * @param {string} matchId - 경기 ID (예: "m201")
 * @returns {Object|null} 리포트 객체 또는 null
 */
export function getReport(matchId) {
  return REPORTS[matchId] || null;
}

/**
 * 리포트가 존재하는 경기만 필터링
 * @param {Array} matches - 경기 배열
 * @returns {Array} 리포트가 있는 경기들
 */
export function filterMatchesWithReports(matches) {
  return matches.filter(m => REPORTS[m.id]);
}

/**
 * 특정 세트의 상세 분석 조회
 * @param {string} matchId - 경기 ID
 * @param {number} setIndex - 세트 인덱스 (0부터 시작)
 * @returns {Object|null} 세트 상세 분석 또는 null
 */
export function getSetReport(matchId, setIndex) {
  const report = REPORTS[matchId];
  if (!report || !report.games || !report.games[setIndex]) {
    return null;
  }
  return report.games[setIndex];
}
