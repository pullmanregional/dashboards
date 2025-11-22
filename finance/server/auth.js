const USER_HEADER = "x-auth-request-user";
const EMAIL_HEADER = "x-auth-request-email";
const GROUPS_HEADER = "x-auth-request-groups";
const EMAIL_RESPONSE_HEADER = "X-User-Email";

const HTTP_403_PAGE = (
  data
) => `<!DOCTYPE html><html><head><title>Restricted</title></head> <body style="text-align: center; font-family: sans-serif; margin-top: 50px;>
<div style="text-align: center;">
  <h2>Permission Required</h2>
  <p style="color: #555;">Please contact your administrator to request access to this page.</p>
</div>
<pre style="display: inline-block; text-align: left; font-size: 0.6rem; color: #CCC; padding: 10px; border-radius: 5px;">Request data: ${data}</pre></body></html>`;

export const getRequestUser = (req) => req.headers[USER_HEADER] || "";
export const getRequestEmail = (req) => req.headers[EMAIL_HEADER] || "";
export const getRequestGroups = (req) => req.headers[GROUPS_HEADER] || "";

// Match fullPath to patternPath. Pattern can contain wildcards like /api/*/additional/path.
function pathMatches(fullPath, patternPath) {
  // Convert pattern with wildcards to regex. Wildcards will match any characters
  // including additional path components. Eg. /api/*/data will match /api/1/2/data
  if (patternPath.includes("*")) {
    const regexPattern = patternPath
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
      .replace(/\*/g, ".*"); // Replace * with regex for any chars
    const regex = new RegExp("^" + regexPattern + "$");
    return regex.test(fullPath);
  }

  // Exact match
  return fullPath === patternPath;
}

function findMatchingAuthRule(fullPath, queryString, authConfig) {
  for (const [pathPattern, config] of Object.entries(authConfig)) {
    // Split pattern into path and query params
    const [patternPath, patternQuery] = pathPattern.split("?");
    if (!pathMatches(fullPath, patternPath)) continue;

    // If pattern has query params, check if they match
    if (patternQuery) {
      const patternParams = new URLSearchParams(patternQuery);
      const requestParams = new URLSearchParams(queryString);

      let paramsMatch = true;
      for (const [key, value] of patternParams.entries()) {
        if (requestParams.get(key) !== value) {
          paramsMatch = false;
          break;
        }
      }
      if (!paramsMatch) continue;
    }
    return config;
  }

  return null;
}

function isUserAuthorized(email, groupList, allowedGroups, allowedEmails) {
  allowedGroups = allowedGroups || [];
  allowedEmails = (allowedEmails || []).map((e) => e.toLowerCase());
  const checkGroups = allowedGroups.length > 0;
  const checkEmail = allowedEmails.length > 0;
  const groupAllowed =
    !checkGroups ||
    allowedGroups.some((allowedGroup) => groupList.includes(allowedGroup));
  const emailAllowed = !checkEmail || allowedEmails.includes(email);

  let auth = !checkGroups && !checkEmail;
  auth = auth || (checkGroups && checkEmail && (groupAllowed || emailAllowed));
  auth = auth || (!checkGroups && checkEmail && emailAllowed);
  auth = auth || (checkGroups && !checkEmail && groupAllowed);

  return auth;
}

export function checkAuthFromConfig(authConfig) {
  return function checkAuth(req, res, next) {
    // Read user groups and email from headers
    console.log(`req: ${req.url}`);
    const user = getRequestUser(req) || "anonymous";
    const email = getRequestEmail(req).toLowerCase() || "none";
    const groups = getRequestGroups(req);
    const groupList = groups?.split(",").map((g) => g.trim()) || [];

    // Get the path relative to BASE_PATH
    const fullPath = req.path;
    const queryString = req.url.includes("?")
      ? req.url.substring(req.url.indexOf("?"))
      : "";

    const authRule = findMatchingAuthRule(fullPath, queryString, authConfig);

    // No rule for this path + query string
    if (!authRule) {
      console.log(`Access denied for path ${fullPath}`);
      const data = { email, groups, path: fullPath, query: queryString };
      return res.status(403).send(HTTP_403_PAGE(JSON.stringify(data)));
    }

    // Check if user is authorized based on matched rule
    const auth = isUserAuthorized(
      email,
      groupList,
      authRule.ALLOWED_GROUPS,
      authRule.ALLOWED_EMAILS
    );
    if (!auth) {
      console.log(`Access denied for user ${user}/${email} [${groups}]`);
      const data = { email, groups, path: fullPath, query: queryString };
      return res.status(403).send(HTTP_403_PAGE(JSON.stringify(data)));
    }

    // For authorized requests, add user info as response headers.
    res.set(EMAIL_RESPONSE_HEADER, email || "none");
    next();
  };
}
