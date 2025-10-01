global.APP_CONFIG = {
  // Encryption key for remote data files
  DATA_KEY: "vLS1LYAi5vuXvBy2s_9_H5rbiMBf4lwxR-cWtmDBSVQ=",

  // S3 connection config
  S3_ACCT_ID: "",
  S3_ACCT_KEY: "",
  S3_URL: "",
  S3_BUCKET: "",

  // If DATA_FILE is specified, we will use it instead of fetching from S3
  // Files specified here are unencrypted and used in dev
  DATA_FILE: "../../../prh-warehouse/prh-finance.sqlite3",

  AUTH: {
    // Allowed user groups that can access /api. Blank to allow all.
    ALLOWED_GROUPS: [],
  },

  // Server configuration
  PORT: 3001,
};
