import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let DB = null;

// ------------------------------------------------------------
// Promise wrappers for DB operations
// ------------------------------------------------------------
const runAsync = (query, params = []) =>
  new Promise((resolve, reject) => {
    if (!DB) {
      return reject(new Error("Database not initialized"));
    }
    DB.run(query, params, function (err) {
      err ? reject(err) : resolve({ id: this.lastID, changes: this.changes });
    });
  });

const getAsync = (query, params = []) =>
  new Promise((resolve, reject) => {
    if (!DB) {
      return reject(new Error("Database not initialized"));
    }
    DB.get(query, params, (err, row) => {
      err ? reject(err) : resolve(row || null);
    });
  });

const allAsync = (query, params = []) =>
  new Promise((resolve, reject) => {
    if (!DB) {
      return reject(new Error("Database not initialized"));
    }
    DB.all(query, params, (err, rows) => {
      err ? reject(err) : resolve(rows || []);
    });
  });

// ------------------------------------------------------------
// Main DB access functions
// ------------------------------------------------------------
// Initialize database and create tables
export function initDB() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, "finance-dashboard.sqlite3");

    DB = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening database:", err);
        reject(err);
        return;
      }

      console.log("Using database:", dbPath);
      initSchema().then(resolve).catch(reject);
    });
  });
}

// Create tables if they don't exist
const initSchema = () =>
  runAsync(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dept TEXT NOT NULL,
    month TEXT NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dept, month)
  )`);

// Return feedback text for a given department and month
export const getFeedback = (dept, month) =>
  getAsync(
    "SELECT comment, updated_at FROM feedback WHERE dept = ? AND month = ?",
    [dept, month]
  );

// Return all feedback for a given department
export const getAllFeedbackForDept = (dept) =>
  allAsync(
    "SELECT month, comment, updated_at FROM feedback WHERE dept = ? ORDER BY month DESC",
    [dept]
  );

// Return all feedback for all departments
export const getAllFeedback = () =>
  allAsync(
    "SELECT dept, month, comment, updated_at FROM feedback ORDER BY dept, month DESC"
  );

// Write feedback for a given department and month to DB
export const saveFeedback = (dept, month, comment) =>
  runAsync(
    `INSERT INTO feedback (dept, month, comment, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(dept, month) DO UPDATE SET
       comment = excluded.comment,
       updated_at = CURRENT_TIMESTAMP`,
    [dept, month, comment]
  );

export function closeDB() {
  if (DB) {
    DB.close((err) => {
      if (err) console.error("Error closing database:", err);
      else console.log("Database closed");
    });
    DB = null;
  }
}
