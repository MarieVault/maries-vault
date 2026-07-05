import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerStoriesRoutes } from "./routes/stories.routes";
import { registerInteractionsRoutes } from "./routes/interactions.routes";
import { registerEntriesRoutes } from "./routes/entries.routes";
import { registerDiscoveryRoutes } from "./routes/discovery.routes";
import { registerAdminRoutes } from "./routes/admin.routes";
import { registerTwitterRoutes } from "./routes/twitter.routes";
import { registerGalleryRoutes } from "./routes/gallery.routes";
import { registerLedgerRoutes } from "./routes/ledger.routes";

// Registers every API route group on the app and returns the HTTP server.
// Route groups live under ./routes/*.routes.ts; each registers a disjoint URL
// namespace so registration order between groups does not affect matching.
export async function registerRoutes(app: Express): Promise<Server> {
  registerAuthRoutes(app);
  registerStoriesRoutes(app);
  registerInteractionsRoutes(app);
  registerEntriesRoutes(app);
  registerDiscoveryRoutes(app);
  registerAdminRoutes(app);
  registerTwitterRoutes(app);
  registerGalleryRoutes(app);
  registerLedgerRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
