import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, connectDb } from './config.js';
import { errorHandler } from './middleware.js';
import auth from './routes/auth.js';
import business from './routes/business.js';
import products from './routes/products.js';
import transactions from './routes/transactions.js';
import customers from './routes/customers.js';
import voice from './routes/voice.js';

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy; needed for per-IP rate limits
app.use(helmet());
app.use(cors({ origin: config.clientUrls, exposedHeaders: ['X-Gnani-Model'] }));
app.use(express.json({ limit: '100kb' }));

const limit = (windowMin, max) => rateLimit({ windowMs: windowMin * 60e3, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests. Please wait a moment.' } });
app.use('/api', limit(15, 600));
app.use('/api/auth', limit(15, 30), auth);
app.use('/api/voice', limit(1, 30), voice);
app.use('/api', business);
app.use('/api/products', products);
app.use('/api/transactions', transactions);
app.use('/api/customers', customers);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

await connectDb();
app.listen(config.port, () => console.log(`[api] http://localhost:${config.port}`));
