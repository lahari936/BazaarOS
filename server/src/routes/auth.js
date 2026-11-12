import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { User, Business } from '../models.js';
import { HttpError, requireAuth, validate } from '../middleware.js';

const r = Router();
const sign = (user) => jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '30d' });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, phone: u.phone });

r.post('/register', async (req, res) => {
  const body = validate(z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    password: z.string().min(8, 'must be at least 8 characters').max(128),
    phone: z.string().trim().max(20).optional(),
  }), req.body);
  if (await User.exists({ email: body.email.toLowerCase() })) throw new HttpError(409, 'Email already registered. Please sign in.');
  const user = await User.create({ ...body, passwordHash: await bcrypt.hash(body.password, 10) });
  res.status(201).json({ token: sign(user), user: pub(user), business: null });
});

r.post('/login', async (req, res) => {
  const body = validate(z.object({ email: z.string().trim().email(), password: z.string().min(1) }), req.body);
  const user = await User.findOne({ email: body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, 'Wrong email or password');
  res.json({ token: sign(user), user: pub(user), business: await Business.findOne({ ownerId: user._id }) });
});

r.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account not found');
  res.json({ user: pub(user), business: await Business.findOne({ ownerId: user._id }) });
});

export default r;
