import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { config } from './config.js';
import { Business } from './models.js';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function requireAuth(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) throw new HttpError(401, 'Not signed in');
  try {
    req.userId = jwt.verify(token, config.jwtSecret).sub;
  } catch {
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }
  next();
}

/** Loads the signed-in user's shop. Every tenant query below must filter by req.business._id. */
export async function requireBusiness(req, _res, next) {
  const business = await Business.findOne({ ownerId: req.userId });
  if (!business) throw new HttpError(409, 'Create your shop first', { code: 'NO_BUSINESS' });
  req.business = business;
  next();
}

export const validate = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new HttpError(400, `${issue.path.join('.') || 'input'}: ${issue.message}`, { issues: r.error.issues });
  }
  return r.data;
};

export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'invalid id');

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.code === 11000) return res.status(409).json({ error: 'Already exists', code: 'DUPLICATE' });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0]?.message || 'Invalid data' });
  if (err.name === 'MulterError') return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Recording too large (max 5 MB)' : err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please retry.' });
}
