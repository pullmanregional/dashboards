import { getAllDepartments } from "./department-config.js";

// State management
let selectedDept = "";
let departments = [];

// DOM elements
const departmentSelect = document.getElementById("department-select");
const goButton = document.getElementById("go-button");
const linkInfo = document.getElementById("link-info");
const linkUrl = document.getElementById("link-url");

function init() {
  const departments = getAllDepartments();

  // Populate the department select dropdown
  departmentSelect.innerHTML =
    '<option value="">Choose a department...</option>';
  departments.forEach((dept) => {
    const option = document.createElement("option");
    option.value = dept.id;
    option.textContent = dept.name;
    departmentSelect.appendChild(option);
  });

  // Event listeners
  departmentSelect.addEventListener("change", handleDepartmentChange);
  goButton.addEventListener("click", handleGoToDashboard);

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
    logoContainer.classList.add("image-loaded");
  } else {
    // Set up load event listener
    logoImage.addEventListener("load", () => {
      logoImage.classList.add("loaded");
      logoContainer.classList.add("image-loaded");
    });

    // Handle error case
    logoImage.addEventListener("error", () => {
      logoContainer.classList.add("image-loaded"); // Hide skeleton even on error
      // Optionally set a fallback or hide the logo area
      console.warn("Logo failed to load");
    });
  }
}

function handleDepartmentChange(event) {
  selectedDept = event.target.value;

  // Enable/disable the go button
  goButton.disabled = !selectedDept;

  // Show/hide link info
  if (selectedDept) {
    const baseUrl =
      window.location.origin +
      window.location.pathname.replace("index.html", "");
    const dashboardUrl = `${baseUrl}kpi.html?dept=${selectedDept}`;

    linkUrl.textContent = dashboardUrl;
    linkUrl.href = dashboardUrl;
  } else {
    linkUrl.textContent = "--";
    linkUrl.href = "#";
  }
}

// Navigate to the selected dashboard
function handleGoToDashboard() {
  if (!selectedDept) return;
  window.location.href = `kpi.html?dept=${selectedDept}`;
}

// Load page once DOM complete
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
