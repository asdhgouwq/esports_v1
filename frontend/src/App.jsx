import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DDragonProvider } from './contexts/DDragonContext';
import Navbar from './components/Navbar';
import DataAttribution from './components/DataAttribution';
import DataSourcesPage from './pages/DataSourcesPage';
import CompetitionPage, { HomeEntry } from './pages/CompetitionPage';
import SchedulePage from './pages/SchedulePage';
import StandingsPage from './pages/StandingsPage';
import TeamsPage from './pages/TeamsPage';
import MatchDetailPage from './pages/MatchDetailPage';
import DataConnectionPage from './pages/DataConnectionPage';

function App() {
  return (
    <DDragonProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#121212] text-white">
          <Navbar />
          <main className="pb-16">
            <Routes>
              <Route path="/" element={<HomeEntry />} />
              <Route path="/leagues/:competitionId" element={<CompetitionPage groupId="regional" />} />
              <Route path="/tournaments/:competitionId" element={<CompetitionPage groupId="international" />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/standings" element={<StandingsPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/match/:gameId" element={<MatchDetailPage />} />
              <Route path="/data-sources" element={<DataSourcesPage />} />
              <Route path="/data-connection" element={<DataConnectionPage />} />
            </Routes>
          </main>
          <DataAttribution />
        </div>
      </BrowserRouter>
    </DDragonProvider>
  );
}

export default App;
