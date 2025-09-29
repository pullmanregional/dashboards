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

// Update the departmental dashboard to view
function setDepartment(deptId, deptName) {
  // Save selected department to session storage so it persists across reloads
  selectedDept = deptId;
  sessionStorage.setItem("dept", deptId);

  deptText.textContent = deptName;
  viewDeptBtn.disabled = !deptId;

  if (deptId) {
    // Show direct link to dashboard for sharing
    const baseUrl =
      window.location.origin +
      window.location.pathname.replace("index.html", "");
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

function init() {
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
