import { Request, Response, NextFunction } from "express";
import * as documentService from "../services/documents.service";

export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) { res.status(400).json({ status: "error", message: "No file provided" }); return; }
    const { claimId, type } = req.body;
    const document = await documentService.uploadDocument(req.user!.id, req.user!.tenantId, claimId, type, req.file.path);
    res.status(201).json({ status: "success", data: document });
  } catch (error) { next(error); }
}

export async function getClaimDocuments(req: Request, res: Response, next: NextFunction) {
  try { const documents = await documentService.getClaimDocuments(String(req.params.claimId)); res.json({ status: "success", data: documents }); }
  catch (error) { next(error); }
}

export async function getDocument(req: Request, res: Response, next: NextFunction) {
  try { const document = await documentService.getDocument(String(req.params.id)); res.json({ status: "success", data: document }); }
  catch (error) { next(error); }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try { await documentService.deleteDocument(String(req.params.id)); res.json({ status: "success", message: "Document deleted" }); }
  catch (error) { next(error); }
}
