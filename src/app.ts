import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import apiRoutes from './routes';
import { errorHandler } from './middlewares/error.middleware';

export const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global UTF-8 charset middleware for all responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Public health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// API routes
app.use('/api', apiRoutes);

// Centralized error handling
app.use(errorHandler);
