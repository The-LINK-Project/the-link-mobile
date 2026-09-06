import app from './app.js';
const port = Number(process.env.PORT ?? 3790);
app.listen(port, '0.0.0.0', () => console.log(`LINK mobile API listening on port ${port}`));

