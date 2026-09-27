import type { NextFunction, Request, Response } from 'express';
import type { Repositories, Session, User } from '../db/types.js';
import type { Env } from '../config/env.js';
import { generateCsrfToken, hashSessionToken, verifyCsrfToken } from './crypto.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionRecord?: Session;
      csrfToken?: string;
    }
  }
}

export function createAuthMiddlewares(repos: Repositories, env: Env) {
  const sessionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.[env.SESSION_COOKIE_NAME];
      if (!token || typeof token !== 'string') {
        return next();
      }

      const tokenHash = hashSessionToken(token);
      const session = await repos.sessions.findByTokenHash(tokenHash);
      if (!session) {
        res.clearCookie(env.SESSION_COOKIE_NAME);
        return next();
      }

      const now = Date.now();
      const expiresAt = new Date(session.expiresAt).getTime();
      const lastActive = new Date(session.lastActiveAt).getTime();
      const inactiveLimitMs = env.SESSION_INACTIVE_LOGOUT_MINUTES * 60 * 1000;

      // Caducidad absoluta o por inactividad (ADR-0007 / patrón Patria)
      if (now >= expiresAt || now - lastActive > inactiveLimitMs) {
        await repos.sessions.deleteByTokenHash(tokenHash);
        res.clearCookie(env.SESSION_COOKIE_NAME);
        return next();
      }

      const user = await repos.users.findById(session.userId);
      if (!user || user.status !== 'active') {
        await repos.sessions.deleteByTokenHash(tokenHash);
        res.clearCookie(env.SESSION_COOKIE_NAME);
        return next();
      }

      req.user = user;
      req.sessionRecord = session;
      req.csrfToken = generateCsrfToken(session.id, env.SESSION_SECRET);

      // Actualizar última actividad
      const nowIso = new Date(now).toISOString();
      await repos.sessions.touch(session.id, nowIso);

      next();
    } catch (err) {
      next(err);
    }
  };

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      if (req.headers['hx-request']) {
        res.setHeader('HX-Redirect', '/login');
        return res.status(401).send();
      }
      return res.redirect('/login');
    }
    next();
  };

  const requireRole = (...roles: User['role'][]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.redirect('/login');
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).send('Acceso denegado: permisos insuficientes');
      }
      next();
    };
  };

  const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    // Solo métodos de modificación de estado (POST, PUT, DELETE, PATCH)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Si no hay sesión autenticada, CSRF no aplica en login/install abierto
    if (!req.sessionRecord) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body?._csrf;
    if (!token || typeof token !== 'string') {
      return res.status(403).send('Falta token CSRF');
    }

    if (!verifyCsrfToken(token, req.sessionRecord.id, env.SESSION_SECRET)) {
      return res.status(403).send('Token CSRF inválido o expirado');
    }

    next();
  };

  return {
    sessionMiddleware,
    requireAuth,
    requireRole,
    csrfProtection,
  };
}
