import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { initDb, pool } from './db.js';
import { typeDefs, resolvers } from './schema.js';
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true }));
app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'error', database: 'disconnected' }); }
});
const server = new ApolloServer({ typeDefs, resolvers, introspection: process.env.NODE_ENV !== 'production' });
await initDb();
await server.start();
app.use('/graphql', express.json({ limit: '100kb' }), expressMiddleware(server));
const port = Number(process.env.PORT || 4000);
app.listen(port, '0.0.0.0', () => console.log(`GraphQL API listening on http://localhost:${port}/graphql`));
process.on('SIGTERM', async () => { await server.stop(); await pool.end(); process.exit(0); });
