import { useMatchData } from '../hooks/useMatchData';
import MatchCard from '../components/MatchCard';
import { LoadingSpinner, ErrorMessage, EmptyState, SectionTitle } from '../components/ui';

export default function SchedulePage() {
  const { matches, loading, error } = useMatchData({ limit: 50 });

  const grouped = matches.reduce((acc, match) => {
    const date = match.datetime_utc
      ? new Date(match.datetime_utc).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Unknown Date';
    if (!acc[date]) acc[date] = [];
    acc[date].push(match);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-8">
      <SectionTitle>Schedule</SectionTitle>

      {loading && <LoadingSpinner message="Loading schedule..." />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && matches.length === 0 && (
        <EmptyState message="No schedule data. Sync data from the home page." />
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([date, dayMatches]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-gray-500 tracking-widest mb-3 uppercase">{date}</div>
              <div className="flex flex-col gap-2">
                {dayMatches.map((match) => (
                  <MatchCard key={match.game_id} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
