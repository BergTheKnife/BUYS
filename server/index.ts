
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { registerProductionApi } from "./productionApi";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Static assets (PWA icons/manifest)
app.use(express.static(path.join(process.cwd(), 'client/public')));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`);
  });
  next();
});

(async () => {
  // Attach legacy/core routes (auth, inventory, sales, expenses, stats, etc.)
  const server = await registerRoutes(app);

  // Attach NEW production & store-config endpoints (after sessions are set up inside registerRoutes)
  await registerProductionApi(app);

  // Setup Vite dev server or serve static files based on environment
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  // Always bind to PORT
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
