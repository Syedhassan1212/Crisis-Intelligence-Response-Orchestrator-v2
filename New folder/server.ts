import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "system_nominal", cycle: 47, uptime: process.uptime() });
  });

  app.get("/api/intelligence", (req, res) => {
    // Simulated intelligence feed
    res.json([
      { id: 1, type: "SIGINT", origin: "Sector 7G", level: "high", msg: "Atmospheric interference rising" },
      { id: 2, type: "GEOINT", origin: "Main Artery", level: "critical", msg: "Visual confirmation of road obstruction" },
    ]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Command Center Uplink established on http://localhost:${PORT}`);
  });
}

startServer();
