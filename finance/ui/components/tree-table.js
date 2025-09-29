import { LitElement, html, css } from "lit";

// TreeTable component for displaying hierarchical data with collapsible rows
// Supports automatic total calculations for parent nodes and custom formatting
export class TreeTable extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    // Array of header objects: { title: string, key: string, align?: string, summable?: boolean, classes?: string }
    headers: { type: Array, default: [] },

    // Array of row objects: { [treeColumn]: string, [header.key]: any, bold?: boolean, highlight?: boolean }
    data: { type: Array },

    // CSS class for maximum height with scrolling
    maxHeight: { type: String, default: "" },

    // Set of tree paths that are currently expanded
    expandedPaths: { type: Set },

    // Name of the column containing tree path data
    treeColumn: { type: String, default: "tree" },

    // Whether to auto-calculate parent row totals
    calculateTotals: { type: Boolean, default: false },

    // Custom function for formatting cell values
    formatter: { type: Object, default: null }, // Custom function for formatting cell values

    // CSS class for font size
    fontSize: { type: String, default: "text-xs" }, // CSS class for font size
  };

  constructor() {
    super();
    this.expandedPaths = new Set();
  }

  // Parse tree path to extract hierarchical information
  // Tree paths use pipe-separated notation: "parent|child|grandchild"
  parseTreePath(treePath) {
    if (!treePath) return { level: 0, parts: [], isCollapsible: false };
    const parts = treePath.split("|");
    return {
      level: parts.length - 1,
      parts,
      isCollapsible: this.hasChildren(treePath),
    };
  }

  // Check if a parent path has any direct children in the data
  // Children are identified by paths that start with parent path + "|"
  hasChildren(parentPath) {
    return this.data.some((row) => {
      const rowTreePath = row[this.treeColumn];
      return (
        rowTreePath &&
        rowTreePath !== parentPath &&
        rowTreePath.startsWith(parentPath + "|")
      );
    });
  }

  // Determine if a row should be visible based on expanded state of its ancestors
  // A row is hidden if any of its parent paths are not in the expandedPaths set
  //
  // The tree column format is: "root|level1|level2|level3"
  // Example: "Patient Revenues|Inpatient"
  //   => pathParts = ["Patient Revenues", "Inpatient"]
  //      .slice(1) = ["Inpatient"]  // Remove root since it is always visible
  //      .some(_, i) = true         // Check if any parent level is not expanded
  //
  isRowVisible(row) {
    const treePath = row[this.treeColumn];
    if (!treePath) return true;

    const pathParts = treePath.split("|");
    return !pathParts
      .slice(1)
      .some(
        (_, i) => !this.expandedPaths.has(pathParts.slice(0, i + 1).join("|"))
      );
  }

  // Toggle expand state for a specific tree path
  // Used when user clicks on collapse/expand arrows
  toggleCollapse(path) {
    this.expandedPaths.has(path)
      ? this.expandedPaths.delete(path)
      : this.expandedPaths.add(path);
    this.requestUpdate();
  }

  // Expand all nodes by adding all parent paths to the expanded paths set
  expandAll() {
    this.data
      .filter(
        (row) => row[this.treeColumn] && this.hasChildren(row[this.treeColumn])
      )
      .forEach((row) => this.expandedPaths.add(row[this.treeColumn]));
    this.requestUpdate();
  }

  // Collapse all parent nodes by clearing the expanded paths set
  collapseAll() {
    this.expandedPaths.clear();
    this.requestUpdate();
  }

  // Recursively calculate totals for parent rows by summing their direct children
  // Only calculates for rows that don't already have data values (parent-only rows)
  // Recursively processes children first to ensure bottom-up calculation
  calculateParentTotals(row) {
    if (!this.calculateTotals) return row;

    // Skip if no tree path or if row already has data values
    const treePath = row[this.treeColumn];
    if (
      !treePath ||
      this.headers.some((header) => header.summable && row[header.key] != null)
    ) {
      return row;
    }

    // Find direct children (not grandchildren) of this parent
    const childRows = this.data.filter((childRow) => {
      const childTreePath = childRow[this.treeColumn];
      return (
        childTreePath &&
        childTreePath !== treePath &&
        childTreePath.startsWith(treePath + "|") &&
        this.getDirectParent(childTreePath) === treePath
      );
    });

    if (childRows.length === 0) return row;

    // Recursively calculate totals for children first
    const calculatedChildren = childRows.map((child) =>
      this.calculateParentTotals(child)
    );
    const calculatedRow = { ...row };

    // Sum up values from direct children for each summable column
    this.headers.forEach((header) => {
      if (header.summable) {
        calculatedRow[header.key] = calculatedChildren.reduce(
          (acc, child) => acc + (parseFloat(child[header.key]) || 0),
          0
        );
      }
    });

    return calculatedRow;
  }

  // Get the direct parent path of a tree path
  // For "parent|child|grandchild", returns "parent|child"
  getDirectParent(treePath) {
    if (!treePath) return null;
    const parts = treePath.split("|");
    return parts.length <= 1 ? null : parts.slice(0, -1).join("|");
  }

  // Format cell values for display, applying custom formatter if provided
  // Default formatting: numbers get locale-specific formatting, null/undefined show as "-"
  formatCellValue(value, header, row) {
    if (this.formatter && typeof this.formatter === "function") {
      return this.formatter(value, header, row);
    }

    if (value === null || value === undefined || value === "") return "-";
    return typeof value === "number" ? value.toLocaleString() : String(value);
  }

  // Render a single table row with tree structure support
  // Handles visibility, indentation, collapse arrows, and special formatting
  renderRow(row) {
    if (!this.isRowVisible(row)) return "";

    const calculatedRow = this.calculateParentTotals(row);
    const treePath = calculatedRow[this.treeColumn];
    const treeInfo = this.parseTreePath(treePath);
    const isBold = !!calculatedRow.bold;
    const isHighlight = !!calculatedRow.highlight;
    const isExpanded = this.expandedPaths.has(treePath);
    const indentLevel = treeInfo.level;

    // Apply special styling for highlighted rows
    const rowClasses = isHighlight
      ? "border-l-3 border-l-warning bg-warning/10"
      : "hover:bg-base-200";

    const cells = this.headers.map((header, headerIndex) => {
      const cellClasses = [
        header.align || "text-left",
        header.classes || "",
        isBold ? "font-bold" : "",
        "py-0 px-2",
      ];

      let cellContent;
      // First column gets tree structure with indentation and collapse icon
      if (headerIndex === 0 && treePath) {
        cellContent = html`
          <div
            class="flex items-center cursor-pointer rounded px-1 py-1"
            style="margin-left: ${indentLevel * 1.5}rem"
            @click="${() => this.toggleCollapse(treePath)}"
          >
            ${treeInfo.isCollapsible
              ? // Chevron icon to expand/collapse the row
                html`
                  <button
                    class="btn btn-ghost btn-xs p-0 w-4 h-4 min-h-0"
                    @click="${(e) => {
                      e.stopPropagation();
                      this.toggleCollapse(treePath);
                    }}"
                    aria-label="${isExpanded ? "Collapse" : "Expand"}"
                  >
                    <svg
                      class="w-3 h-3 transform transition-transform duration-200 ${isExpanded
                        ? "rotate-90"
                        : ""}"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </button>
                `
              : // Empty horizontal space if not collapsible
                html`<span class="w-4 inline-block"></span>`}
            <span class="ml-1"
              >${this.formatCellValue(
                calculatedRow[header.key],
                header,
                calculatedRow
              )}</span
            >
          </div>
        `;
      } else {
        // Other columns just display formatted values
        cellContent = this.formatCellValue(
          calculatedRow[header.key],
          header,
          calculatedRow
        );
      }

      return html`<td class="${cellClasses.join(" ")}">${cellContent}</td>`;
    });

    return html`<tr class="${rowClasses}">
      ${cells}
    </tr>`;
  }

  // Render a single header cell with expand/collapse button for first column
  renderHeader(header, index) {
    return html`
      <th class="${header.align || "text-left"}">
        ${index === 0
          ? // First column gets expand/collapse all button
            html`
              <div class="flex items-center gap-2">
                <button
                  class="btn btn-ghost btn-xs hover:bg-base-300 px-1 py-1 border-0"
                  @click="${() =>
                    this.expandedPaths.size > 0
                      ? this.collapseAll()
                      : this.expandAll()}"
                  title="${this.expandedPaths.size > 0
                    ? "Collapse All"
                    : "Expand All"}"
                >
                  <i
                    class="${this.expandedPaths.size > 0
                      ? "fa-regular fa-minus-square"
                      : "fa-regular fa-plus-square"}"
                  ></i>
                </button>
                <span>${header.title}</span>
              </div>
            `
          : header.title}
      </th>
    `;
  }

  // Main render method that creates the complete table structure
  render() {
    const containerClass = this.maxHeight
      ? `overflow-x-auto ${this.maxHeight}`
      : "overflow-x-auto";

    return html`
      <div class="${containerClass}">
        <table class="table table-xs table-hover ${this.fontSize}">
          <thead class="sticky top-0 bg-base-200 text-xs uppercase">
            <tr>
              ${this.headers.map((header, index) =>
                this.renderHeader(header, index)
              )}
            </tr>
          </thead>
          <tbody>
            ${this.data.map((row) => this.renderRow(row))}
          </tbody>
        </table>
      </div>
    `;
  }
}

window.customElements.define("tree-table", TreeTable);
