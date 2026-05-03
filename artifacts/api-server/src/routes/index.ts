import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import placesRouter from "./places.js";
import themesRouter from "./themes.js";
import sitesRouter from "./sites.js";
import authRouter from "./auth.js";
import adminRouter from "./admin.js";
import stripeRouter from "./stripe.js";
import mediaRouter from "./media.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/places", placesRouter);
router.use("/themes", themesRouter);
router.use("/sites", sitesRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/stripe", stripeRouter);
router.use("/media", mediaRouter);

export default router;
