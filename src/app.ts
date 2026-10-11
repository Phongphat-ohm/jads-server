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

// Public health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// API routes
app.use('/api', apiRoutes);

// Centralized error handling
app.use(errorHandler);
