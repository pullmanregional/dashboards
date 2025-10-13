import { getAllDepartments } from "./department-config.js";

// State management
let selectedDept = "";

// DOM elements
const viewAdminBtn = document.getElementById("btn-view-admin");
const deptText = document.getElementById("dept-text");
const deptMenu = document.getElementById("dept-menu");
const deptLinkText = document.getElementById("dept-link-text");
const deptLinkUrl = document.getElementById("dept-link-url");
const viewDeptBtn = document.getElementById("btn-view-dept");
const userEmailEl = document.getElementById("user-email");

// Update the departmental dashboard to view
function setDepartment(deptId, deptName) {
  // Save selected department to session storage so it persists across reloads
  selectedDept = deptId;
  sessionStorage.setItem("dept", deptId);

  deptText.textContent = deptName;
  viewDeptBtn.disabled = !deptId;

  if (deptId) {
    // Show direct link to dashboard for sharing
    const url = new URL(window.location.href);
    const path = url.pathname.substring(0, url.pathname.lastIndexOf("/") + 1);
    const baseUrl = url.origin + path;
    const dashboardUrl = `${baseUrl}kpi.html?dept=${deptId}`;
    deptLinkText.textContent = "Share:";
    deptLinkUrl.textContent = dashboardUrl;
    deptLinkUrl.href = dashboardUrl;
    deptLinkUrl.classList.remove("hidden");
    deptLinkUrl.classList.add("show");
  } else {
    // Clear link info
    deptLinkText.innerHTML = "&nbsp;";
    deptLinkUrl.href = "#";
    deptLinkUrl.classList.add("hidden");
    deptLinkUrl.classList.remove("show");
  }
}

function handleDepartmentChange(event) {
  if (event.target.tagName !== "A") return;
  document.activeElement.blur();
  setDepartment(
    event.target.getAttribute("data-value"),
    event.target.textContent
  );
}

async function populateAcctMenu() {
  userEmailEl.textContent = "Not logged in";
  try {
    const resp = await fetch(window.location.href);
    const userEmail = resp?.headers?.get("x-user-email");
    if (userEmail) {
      userEmailEl.textContent = userEmail;
    }
  } catch (e) {
    console.error("Unable to fetch user info:", e);
  }
}

function init() {
  // Fill in account menu with user's email
  populateAcctMenu();

  // Populate department menu
  getAllDepartments().forEach((dept) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.setAttribute("data-value", dept.id);
    a.textContent = dept.name;
    li.appendChild(a);
    deptMenu.appendChild(li);
  });

  // Restore department selection from session storage
  const savedDept = sessionStorage.getItem("dept");
  if (savedDept) {
    const deptElement = deptMenu.querySelector(`a[data-value="${savedDept}"]`);
    if (deptElement) {
      setDepartment(savedDept, deptElement.textContent);
    }
  }

  // Event listeners
  deptMenu.addEventListener("click", handleDepartmentChange);
  viewDeptBtn.addEventListener("click", () => {
    if (selectedDept) {
      window.location.href = `kpi.html?dept=${selectedDept}`;
    }
  });
  viewAdminBtn.addEventListener("click", () => {
    window.location.href = "admin.html";
  });
}

// Load page once DOM complete
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
