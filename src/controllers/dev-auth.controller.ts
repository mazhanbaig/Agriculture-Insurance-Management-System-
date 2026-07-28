import { Request, Response, NextFunction } from "express";
import * as devAuthService from "../services/dev-auth.service";

/**
 * DEV ONLY: Seed a test user (bypasses Supabase).
 */
export async function seedUser(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await devAuthService.seedDevUser(req.body);
    res.status(201).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * DEV ONLY: Login by email (no password check).
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ status: "error", message: "Email is required" });
      return;
    }
    const result = await devAuthService.devLogin(email);
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * DEV ONLY: List all users with auth source info.
 */
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await devAuthService.listDevUsers();
    res.json({ status: "success", data: users });
  } catch (error) {
    next(error);
  }
}
