import { Router } from "express";
import { THEMES } from "../lib/themes.js";

const router = Router();

router.get("/", (_req, res) => {
  return res.json({ themes: THEMES });
});

export default router;
