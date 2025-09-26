import { LitElement, html, css } from "lit";

export class TreeTable extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    title: { type: String, default: "" },
    headers: { type: Array, default: [] },
    data: { type: Array },
    maxHeight: { type: String, default: "" },
    collapsedPaths: { type: Set },
    treeColumn: { type: String, default: "tree" },
    calculateTotals: { type: Boolean, default: false },
    formatter: { type: Object, default: null },
    collapsed: { type: Boolean, default: true },
    compact: { type: Boolean, default: false },
    fontSize: { type: String, default: "text-sm" },
  };

  constructor() {
    super();
    this.collapsedPaths = new Set();
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("data") && this.data && this.collapsed) {
      this.initializeCollapsedState();
    }
  }

  initializeCollapsedState() {
    this.collapsedPaths.clear();
    this.data
      .filter(
        (row) => row[this.treeColumn] && this.hasChildren(row[this.treeColumn])
      )
      .forEach((row) => this.collapsedPaths.add(row[this.treeColumn]));
  }

  parseTreePath(treePath) {
    if (!treePath) return { level: 0, parts: [], isCollapsible: false };
    const parts = treePath.split("|");
    return {
      level: parts.length - 1,
      parts,
      isCollapsible: this.hasChildren(treePath),
    };
  }

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

  isRowVisible(row) {
    const treePath = row[this.treeColumn];
    if (!treePath) return true;

    const pathParts = treePath.split("|");
    return !pathParts
      .slice(1)
      .some((_, i) =>
        this.collapsedPaths.has(pathParts.slice(0, i + 1).join("|"))
      );
  }

  toggleCollapse(path) {
    this.collapsedPaths.has(path)
      ? this.collapsedPaths.delete(path)
      : this.collapsedPaths.add(path);
    this.requestUpdate();
  }

  expandAll() {
    this.collapsedPaths.clear();
    this.requestUpdate();
  }

  collapseAll() {
    this.initializeCollapsedState();
    this.requestUpdate();
  }

  calculateParentTotals(row) {
    if (!this.calculateTotals) return row;

    const treePath = row[this.treeColumn];
    if (!treePath || this.hasDataValues(row)) return row;

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

    const calculatedChildren = childRows.map((child) =>
      this.calculateParentTotals(child)
    );
    const calculatedRow = { ...row };

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

  hasDataValues(row) {
    return this.headers.some(
      (header) => header.summable && row[header.key] != null
    );
  }

  getDirectParent(treePath) {
    if (!treePath) return null;
    const parts = treePath.split("|");
    return parts.length <= 1 ? null : parts.slice(0, -1).join("|");
  }

  isBoldRow(row) {
    return row.bold === true;
  }
  isHighlightRow(row) {
    return row.highlight === true;
  }

  formatCellValue(value, header, row) {
    if (this.formatter && typeof this.formatter === "function") {
      return this.formatter(value, header, row);
    }

    if (value === null || value === undefined || value === "") return "-";
    return typeof value === "number" ? value.toLocaleString() : String(value);
  }

  renderCollapseArrow(isCollapsible, isCollapsed, onClick) {
    if (!isCollapsible) {
      return html`<span class="w-4 inline-block"></span>`;
    }

    return html`
      <button
        class="btn btn-ghost btn-xs p-0 w-4 h-4 min-h-0"
        @click="${(e) => {
          e.stopPropagation();
          onClick();
        }}"
        aria-label="${isCollapsed ? "Expand" : "Collapse"}"
      >
        <svg
          class="w-3 h-3 transform transition-transform duration-200 ${isCollapsed
            ? ""
            : "rotate-90"}"
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
    `;
  }

  renderRow(row, index) {
    if (!this.isRowVisible(row)) return "";

    const calculatedRow = this.calculateParentTotals(row);
    const treePath = calculatedRow[this.treeColumn];
    const treeInfo = this.parseTreePath(treePath);
    const isBold = this.isBoldRow(calculatedRow);
    const isHighlight = this.isHighlightRow(calculatedRow);
    const isCollapsed = this.collapsedPaths.has(treePath);
    const indentLevel = treeInfo.level;

    const rowClasses = [
      isHighlight ? "tree-table-highlight" : "",
      !isHighlight && !this.hasDataValues(row) ? "!border-base-300" : "",
    ].filter(Boolean);

    const cells = this.headers.map((header, headerIndex) => {
      const cellClasses = [
        header.align || "text-left",
        header.classes || "",
        isBold ? "font-bold" : "",
        this.compact ? "py-0 px-2" : "",
      ].filter(Boolean);

      let cellContent;
      if (headerIndex === 0 && treePath) {
        cellContent = html`
          <div
            class="flex items-center cursor-pointer rounded px-1 py-1"
            style="margin-left: ${indentLevel * 1.5}rem"
            @click="${() => this.toggleCollapse(treePath)}"
          >
            ${this.renderCollapseArrow(
              treeInfo.isCollapsible,
              isCollapsed,
              () => this.toggleCollapse(treePath)
            )}
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
        cellContent = this.formatCellValue(
          calculatedRow[header.key],
          header,
          calculatedRow
        );
      }

      return html`<td class="${cellClasses.join(" ")}">${cellContent}</td>`;
    });

    return html`<tr class="${rowClasses.join(" ")}">
      ${cells}
    </tr>`;
  }

  render() {
    const containerClass = this.maxHeight
      ? `overflow-x-auto ${this.maxHeight}`
      : "overflow-x-auto";

    return html`
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body p-4">
          <h2 class="card-title text-lg border-b border-base-300 pb-2 mb-4">
            ${this.title}
          </h2>
          <div class="${containerClass}">
            <table
              class="table ${this.compact
                ? "table-xs"
                : "table-sm"} table-hover ${this.fontSize}"
            >
              <thead class="sticky top-0 bg-base-200">
                <tr>
                  ${this.headers.map(
                    (header, index) => html`
                      <th class="${header.align || "text-left"}">
                        ${index === 0
                          ? html`
                              <div class="flex items-center gap-2">
                                <button
                                  class="btn btn-ghost btn-xs hover:bg-base-300 px-1 py-1 border-0"
                                  @click="${() =>
                                    this.collapsedPaths.size > 0
                                      ? this.expandAll()
                                      : this.collapseAll()}"
                                  title="${this.collapsedPaths.size > 0
                                    ? "Expand All"
                                    : "Collapse All"}"
                                >
                                  <i
                                    class="${this.collapsedPaths.size > 0
                                      ? "fa-regular fa-plus-square"
                                      : "fa-regular fa-minus-square"}"
                                  ></i>
                                </button>
                                <span>${header.title}</span>
                              </div>
                            `
                          : header.title}
                      </th>
                    `
                  )}
                </tr>
              </thead>
              <tbody>
                ${this.data.map((row, index) => this.renderRow(row, index))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

window.customElements.define("tree-table", TreeTable);
