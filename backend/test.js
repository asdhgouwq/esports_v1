const leaguepediaService = require('./src/services/leaguepedia');
const ddragonService = require('./src/services/ddragon');

async function testPipeline() {
  console.log('--- Step 1 Pipeline Test ---');
  
  await ddragonService.init();
  
  console.log('\n[1] Fetching LCK Matches...');
  const matches = await leaguepediaService.getRecentMatches('LCK 2024 Spring', 1);
  
  if (matches.length === 0) {
    console.log('No matches found for the given criteria.');
    return;
  }
  
  const latestMatch = matches[0];
  console.log('Latest Match:', latestMatch.Team1, 'vs', latestMatch.Team2);
  console.log('Win Team:', latestMatch.WinTeam);
  
  console.log('\n[2] Mapping Data Dragon URLs...');
  const bluePicks = latestMatch.Team1Picks ? latestMatch.Team1Picks.split(',') : [];
  console.log('Blue Team Picks:');
  bluePicks.forEach(pick => {
    console.log(`- ${pick}: ${ddragonService.getChampionImageUrl(pick)}`);
  });

  console.log('\n[3] Fetching Player Stats...');
  const players = await leaguepediaService.getPlayerStats(latestMatch.GameId);
  console.log(`Found ${players.length} players for GameId: ${latestMatch.GameId}`);
  
  if (players.length > 0) {
    const p = players[0];
    console.log(`\nSample Player: ${p.Name} (${p.Role})`);
    console.log(`KDA: ${p.Kills}/${p.Deaths}/${p.Assists}`);
    console.log(`Champion: ${p.Champion} -> ${ddragonService.getChampionImageUrl(p.Champion)}`);
    console.log(`Item0: ${p.Item0} -> ${ddragonService.getItemImageUrl(p.Item0)}`);
  }
}

testPipeline().catch(console.error);
