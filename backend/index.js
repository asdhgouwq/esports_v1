require('dotenv').config();
const express = require('express');
const cors = require('cors');
const ddragonService = require('./src/services/ddragon');
const routes = require('./src/api/routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

ddragonService.init().then(() => {
  console.log('[Express] DataDragon initialization finished.');
});

app.use('/api', routes);

app.listen(port, () => {
  console.log(`[Express] Server running on port ${port}`);
});
