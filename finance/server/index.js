import express from "express";
import { S3Client } from "@aws-sdk/client-s3";
import * as data from "./data.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const USER_HEADER = "x-auth-request-user";
const EMAIL_HEADER = "x-auth-request-email";
const GROUPS_HEADER = "x-auth-request-groups";

// Configuration and data
const DATA = {
  DATA_FILE: null,
  DATA_JSON: null,
};
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
  const allowedGroups = CONFIG.AUTH.ALLOWED_GROUPS;
  const getRequestUser = (req) =>
    req.headers[USER_HEADER] || req.headers[EMAIL_HEADER] || "none";
  const getRequestGroups = (req) => req.headers[GROUPS_HEADER] || "";
  function checkAuth(req, res, next) {
    // Read user groups from header and check against authorized groups
    // If authorized groups is blank or null, allow all groups
    const user = getRequestUser(req);
    const groups = getRequestGroups(req);
    const groupList = groups?.split(",").map((g) => g.trim()) || [];
    const hasAccess =
      !(allowedGroups?.length > 0) ||
      allowedGroups.some((allowedGroup) => groupList.includes(allowedGroup));

    if (!hasAccess) {
      console.log(`Access denied for user ${user} [${groups}]`);
      return res.status(403).json({
        error: "Unauthorized user group",
        userGroups: groups,
      });
    }

    next();
  }

  // Logging middleware
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const originalSend = res.send;
    res.send = function (data) {
      const user = getRequestUser(req);
      console.log(
        `[${timestamp}] ${req.method} ${req.path} (${res.statusCode}) - ${user} ${req.ip}`
      );
      originalSend.call(this, data);
    };
    next();
  });

  // Load data files
  let reloadTimer = null;
  async function loadDataFiles() {
    let dataFile, jsonTxt;
    if (CONFIG.DATA_FILE && CONFIG.DATA_JSON) {
      // Use local files (development mode)
      ({ dataFile, jsonTxt } = data.readLocal(
        CONFIG.DATA_FILE,
        CONFIG.DATA_JSON
      ));
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
      const jsonFile = await data.s3fetch(s3, bucket, "prh-finance.json.enc");

      // Decrypt
      dataFile = data.decrypt(dbFile, CONFIG.DATA_KEY);
      jsonTxt = data.decrypt(jsonFile, CONFIG.DATA_KEY).toString("utf8");
    }
    DATA.DATA_FILE = dataFile;
    DATA.DATA_JSON = jsonTxt;

    // Refresh data files every 4 hours
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(loadDataFiles, 4 * 60 * 60 * 1000);
  }

  // ------------------------------------------------------------
  // Static files
  // ------------------------------------------------------------
  // Serve ../ui/dist (built with npm run build)
  app.use(express.static(path.join(__dirname, "..", "ui", "dist")));

  // ------------------------------------------------------------
  // API routes
  // ------------------------------------------------------------
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      datalen: DATA.DATA_FILE?.length,
    });
  });
  app.get("/api/reload", checkAuth, async (req, res) => {
    await loadDataFiles();
    res.ok();
  });
  app.get("/api/data", checkAuth, (req, res) => {
    if (!DATA.DATA_FILE) {
      return res.status(503).json({ error: "Database not available" });
    }
    res.type("application/octet-stream").send(DATA.DATA_FILE);
  });
  app.get("/api/kvdata", checkAuth, (req, res) => {
    if (!DATA.DATA_JSON) {
      return res.status(503).json({ error: "KV data not available" });
    }
    res.type("application/json").send(DATA.DATA_JSON);
  });

  // Load data files and start server
  console.log("Fetching data...");
  await loadDataFiles();
  console.log(
    `DB: ${DATA.DATA_FILE.length / 1024} kb, KV: ${DATA.DATA_JSON.length} bytes`
  );
  app.listen(CONFIG.PORT, () => {
    console.log(`Server running on http://localhost:${CONFIG.PORT}`);
  });
}

// Start the server
main();
