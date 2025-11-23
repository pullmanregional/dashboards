global.APP_CONFIG = {
  // Encryption key for remote data files
  DATA_KEY: "",

  // S3 connection config
  S3_ACCT_ID: "",
  S3_ACCT_KEY: "",
  S3_URL: "",
  S3_BUCKET: "",

  // If DATA_FILE is specified, we will use it instead of fetching from S3
  // Files specified here are unencrypted and used in dev
  DATA_FILE: "../../../prh-warehouse/prh-finance.sqlite3",

  AUTH: {
    // Map of "path?param=value" to allowed groups and emails
    // Query params that are specified are matched exactly. Params that are not specified
    // but present in the request are ignored.
    // Path should be relative to BASE_PATH
    // Paths support wildcards (e.g., /api/* matches /api/data, /api/reload, etc.)
    //
    // Example: "/kpi.html?dept=msu_icu": { ALLOWED_GROUPS: [], ALLOWED_EMAILS: [] }
    //
    // Request is authorized if matches group OR email for the matching path rule.
    // By default, access is denied unless explicitly allowed.
    "/": {
      ALLOWED_GROUPS: [],
      ALLOWED_EMAILS: [],
    },
    "/assets/*": {
      ALLOWED_GROUPS: [],
      ALLOWED_EMAILS: [],
    },
    "/kpi.html": {
      ALLOWED_GROUPS: [],
      ALLOWED_EMAILS: [],
    },
    "/admin.html": {
      ALLOWED_GROUPS: [],
      ALLOWED_EMAILS: [],
    },
    "/api/*": {
      ALLOWED_GROUPS: [],
      ALLOWED_EMAILS: [],
    },
  },

  // Server configuration
  PORT: 8505,
  BASE_PATH: "/finance",
};
