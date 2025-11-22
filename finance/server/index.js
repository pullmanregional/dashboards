import express from "express";
import { S3Client } from "@aws-sdk/client-s3";
import * as auth from "./auth.js";
import * as data from "./data.js";
import {
  initDB,
  getFeedback,
  getAllFeedbackForDept,
  getAllFeedback,
  saveFeedback,
} from "./db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const router = express.Router();
app.use(express.json());

// Configuration and data
let DATA_FILE = null;

async function getAppConfig() {
  await import("../server-config.js");
  const config = global.APP_CONFIG;
  if (!config) {
    throw new Error("Invalid config.js");
  }
  return config;
}

async function main() {
  // Load configuration
  const CONFIG = await getAppConfig();

  // ------------------------------------------------------------
  // Middleware
  // ------------------------------------------------------------
  // oauth2-proxy middleware. Auth info is sent via headers
  const checkAuth = auth.checkAuthFromConfig(CONFIG.AUTH);

  // Logging middleware
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const originalSend = res.send;
    res.send = function (data) {
      const user = auth.getRequestUser(req);
      const email = auth.getRequestEmail(req);
      console.log(
        `[${timestamp}] ${req.method} ${req.path} (${res.statusCode}) - ${user}/${email} ${req.ip}`
      );
      originalSend.call(this, data);
    };
    next();
  });

  // Load data files
  let reloadTimer = null;
  async function loadDataFiles() {
    let dataFile;
    if (CONFIG.DATA_FILE) {
      // Use local files (development mode)
      dataFile = data.readLocal(CONFIG.DATA_FILE);
    } else {
      // Fetch remote files
      const s3 = new S3Client({
        region: "auto",
        endpoint: CONFIG.S3_URL,
        credentials: {
          accessKeyId: CONFIG.S3_ACCT_ID,
          secretAccessKey: CONFIG.S3_ACCT_KEY,
        },
      });
      const bucket = CONFIG.S3_BUCKET;
      const dbFile = await data.s3fetch(s3, bucket, "prh-finance.sqlite3.enc");

      // Decrypt
      dataFile = data.decrypt(dbFile, CONFIG.DATA_KEY);
    }
    DATA_FILE = dataFile;

    // Refresh data files every 4 hours
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(loadDataFiles, 4 * 60 * 60 * 1000);
  }

  // ------------------------------------------------------------
  // Unauthenticated resources
  // ------------------------------------------------------------
  router.get("/health", (req, res) => {
    res.json({
      status: "ok",
      datalen: DATA_FILE?.length,
    });
  });

  // ------------------------------------------------------------
  // Static files
  // ------------------------------------------------------------
  // Serve ../ui/dist (built with npm run build)
  router.use(
    checkAuth,
    express.static(path.join(__dirname, "..", "ui", "dist"))
  );

  // ------------------------------------------------------------
  // API routes
  // ------------------------------------------------------------
  router.get("/api/reload", checkAuth, async (req, res) => {
    await loadDataFiles();
    res.status(200).send("Reloaded");
  });
  router.get("/api/data", checkAuth, (req, res) => {
    if (!DATA_FILE) {
      return res.status(503).json({ error: "Database not available" });
    }
    res
      .type("application/octet-stream")
      .set("Cache-Control", "private, max-age=14400")
      .send(DATA_FILE);
  });

  // Feedback endpoints
  router.get("/api/feedback", checkAuth, async (req, res) => {
    try {
      const feedback = await getAllFeedback();
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  router.get("/api/feedback/:dept", checkAuth, async (req, res) => {
    try {
      const { dept } = req.params;
      const feedback = await getAllFeedbackForDept(dept);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  router.get("/api/feedback/:dept/:month", checkAuth, async (req, res) => {
    try {
      const { dept, month } = req.params;
      const feedback = await getFeedback(dept, month);
      res.json(feedback || { comment: "" });
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  router.post("/api/feedback/:dept/:month", checkAuth, async (req, res) => {
    try {
      const { dept, month } = req.params;
      const { comment } = req.body;

      if (typeof comment !== "string") {
        return res.status(400).json({ error: "Comment must be text" });
      }

      const result = await saveFeedback(dept, month, comment);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error saving feedback:", error);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  // Mount router at configured base path
  app.use(CONFIG.BASE_PATH, router);

  // Initialize feedback database
  await initDB();

  // Load data files and start server
  console.log("Fetching data...");
  await loadDataFiles();
  console.log(`DB: ${DATA_FILE.length / 1024} kb`);
  app.listen(CONFIG.PORT, () => {
    console.log(`Server at http://localhost:${CONFIG.PORT}${CONFIG.BASE_PATH}`);
  });
}

// Start the server
main();
