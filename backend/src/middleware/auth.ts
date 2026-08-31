import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set");
}

export interface AuthRequest extends Request {
  userId?: string;
  userWallet?: string;
  isAdmin?: boolean;
}

export function userAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET!) as {
      sub: string;
      wallet: string;
      isAdmin?: boolean;
    };
    req.userId = payload.sub;
    req.userWallet = payload.wallet;
    req.isAdmin = payload.isAdmin || false;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET!) as {
        sub: string;
        wallet: string;
        isAdmin?: boolean;
      };
      req.userId = payload.sub;
      req.userWallet = payload.wallet;
      req.isAdmin = payload.isAdmin || false;
    } catch {}
  }
  next();
}

export function adminAuth(req: AuthRequest, res: Response, next: NextFunction) {
  userAuth(req, res, () => {
    if (!req.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
