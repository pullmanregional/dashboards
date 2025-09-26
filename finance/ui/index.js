import { getAllDepartments } from "./department-config.js";

// State management
let selectedDept = "";
let departments = [];

// DOM elements
const departmentSelect = document.getElementById("department-select");
const departmentText = document.getElementById("department-text");
const departmentMenu = document.querySelector(".dropdown-content.menu");
const goButton = document.getElementById("go-button");
const adminButton = document.getElementById("admin-button");
const linkInfoText = document.getElementById("link-info-text");
const linkUrl = document.getElementById("link-url");

function init() {
  const departments = getAllDepartments();

  // Populate the department dropdown menu
  departmentMenu.innerHTML =
    '<li><a data-value="">Choose a department...</a></li>';
  departments.forEach((dept) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.setAttribute("data-value", dept.id);
    a.textContent = dept.name;
    li.appendChild(a);
    departmentMenu.appendChild(li);
  });

  // Event listeners
  departmentMenu.addEventListener("click", handleDepartmentChange);
  goButton.addEventListener("click", handleGoToDashboard);
  adminButton.addEventListener("click", handleGoToAdmin);

  // Handle smooth logo loading
  setupLogoLoading();
}

function setupLogoLoading() {
  const logoContainer = document.querySelector(".logo");
  const logoImage = logoContainer?.querySelector("img");

  if (!logoImage || !logoContainer) return;

  // If image is already loaded (cached), show it immediately
  if (logoImage.complete && logoImage.naturalHeight !== 0) {
    logoImage.classList.add("loaded");
  } else {
    // Set up load event listener
    logoImage.addEventListener("load", () => {
      logoImage.classList.add("loaded");
    });

    // Handle error case
    logoImage.addEventListener("error", () => {
      console.warn("Logo failed to load");
    });
  }
}

function handleDepartmentChange(event) {
  const target = event.target;
  if (target.tagName !== "A") return;

  selectedDept = target.getAttribute("data-value");

  // Update the button text and hide dropdown
  departmentText.textContent = target.textContent;
  document.activeElement.blur();

  // Enable/disable the go button
  goButton.disabled = !selectedDept;

  // Show/hide link info
  if (selectedDept) {
    const baseUrl =
      window.location.origin +
      window.location.pathname.replace("index.html", "");
    const dashboardUrl = `${baseUrl}kpi.html?dept=${selectedDept}`;

    linkInfoText.textContent = "Share:";
    linkUrl.textContent = dashboardUrl;
    linkUrl.href = dashboardUrl;
    linkUrl.classList.remove("hidden");
    linkUrl.classList.add("show");
  } else {
    linkInfoText.innerHTML = "&nbsp;";
    linkUrl.href = "#";
    linkUrl.classList.add("hidden");
    linkUrl.classList.remove("show");
  }
}

// Navigate to the selected dashboard
function handleGoToDashboard() {
  if (!selectedDept) return;
  window.location.href = `kpi.html?dept=${selectedDept}`;
}

// Navigate to admin dashboard
function handleGoToAdmin() {
  window.location.href = "admin.html";
}

// Load page once DOM complete
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
