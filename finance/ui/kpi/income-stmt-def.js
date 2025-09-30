// Defines the structure and hierarchy of the income statement
export const INCOME_STMT_DEF = [
  {
    name: "Patient Revenues",
    items: [
      {
        name: "Inpatient",
        items: [
          {
            account: "40000:Patient Revenues",
            category: "Inpatient Revenue",
            negative: true,
          },
          {
            account: "40000:Patient Revenues",
            category: "Inpatient Revenue_40000",
            negative: true,
          },
        ],
      },
      {
        name: "Outpatient",
        items: [
          {
            account: "40000:Patient Revenues",
            category: "Outpatient Revenue",
            negative: true,
          },
          {
            account: "40000:Patient Revenues",
            category: "Outpatient Revenue_40000",
            negative: true,
          },
          {
            account: "40000:Patient Revenues",
            category: "Clinic Revenue",
            negative: true,
          },
          {
            account: "40000:Patient Revenues",
            category: "Clinic Revenue_40000",
            negative: true,
          },
        ],
      },
    ],
  },
  {
    name: "Other Revenue",
    items: [
      {
        name: "Sales Revenue",
        items: [{ account: "40010:Sales Revenue", negative: true }],
      },
      {
        name: "Service Revenue",
        items: [
          { account: "40030:Service Revenue", negative: true },
          { account: "40031:EPIC Miscellaneous Revenue", negative: true },
        ],
      },
      {
        name: "Grants Revenue",
        items: [{ account: "40100:Grants Revenue", negative: true }],
      },
      {
        name: "Donations",
        items: [{ account: "40200:Donations", negative: true }],
      },
      {
        name: "Other Operating Revenue",
        items: [
          { account: "40300:Other Operating Revenue", negative: true },
          { account: "40301:Gain/Loss on Sale", negative: true },
        ],
      },
      {
        name: "Interest Income",
        items: [{ account: "47000:Interest Income", negative: true }],
      },
    ],
  },
  {
    name: "Deductions",
    items: [
      {
        name: "Contractual Adjustments",
        items: [
          { account: "49000:Contractual Adjustments" },
          { account: "49001:Bad Debts & Write Offs" },
          { account: "49002:Administrative Write Offs" },
          { account: "49003:Employee Discount" },
          { account: "49004:Implementation Write-offs" },
        ],
      },
    ],
  },
  {
    name: "Net Revenue",
    total: ["Patient Revenues/", "Other Revenue/", "-Deductions"],
    highlight: true,
  },
  {
    name: "Salaries & Benefits",
    items: [
      {
        name: "Salaries & Wages",
        items: [{ account: "50000:Salaries & Wages", category: "*" }],
      },
      {
        name: "Benefits",
        items: [
          { account: "50011:Benefits-Taxes", category: "*" },
          { account: "50012:Benefits-Insurance", category: "*" },
          { account: "50013:Benefits-Retirement", category: "*" },
          { account: "50014:Benefits-Other", category: "*" },
        ],
      },
    ],
  },
  {
    name: "Other Direct Expenses",
    items: [
      {
        name: "Professional Fees",
        items: [
          { account: "60220:Professional Fees", category: "*" },
          { account: "60221:Temp Labor", category: "*" },
          { account: "60222:Locum Tenens", category: "*" },
        ],
      },
      {
        name: "Supplies",
        items: [
          { account: "60300:Supplies", category: "*" },
          { account: "60301:Inventory Adjustments", category: "*" },
          { account: "60302:Expired Wasted Supplies", category: "*" },
          { account: "60336:Pharmaceuticals", category: "*" },
        ],
      },
      {
        name: "Utilities",
        items: [{ account: "60500:Utilities", category: "*" }],
      },
      {
        name: "Purchased Services",
        items: [
          { account: "60600:Purchased Services", category: "*" },
          { account: "60620:Maintenance", category: "*" },
          { account: "60650:Software Licenses", category: "*" },
        ],
      },
      {
        name: "Depreciation",
        items: [{ account: "70000:Depreciation", category: "*" }],
      },
      {
        name: "Rental/Leases",
        items: [{ account: "60800:Leases/Rents Operating", category: "*" }],
      },
      {
        name: "Insurance",
        items: [
          { account: "60900:Insurance-Professional", category: "*" },
          { account: "60901:Insurance-Other", category: "*" },
        ],
      },
      {
        name: "Licenses & Taxes",
        items: [
          { account: "61000:Taxes-Hospital B&O", category: "*" },
          { account: "61001:Taxes-Sales and Use", category: "*" },
          { account: "61002:Taxes-Property", category: "*" },
          { account: "61003:Licensing Fees State", category: "*" },
        ],
      },
      {
        name: "Other Direct Expenses",
        items: [
          { account: "60951:Professional Memberships", category: "*" },
          { account: "60960:Other Direct Expenses", category: "*" },
          { account: "60961:EFT-Collection Fees", category: "*" },
          { account: "60962:Safety Net (DSH) Assessments", category: "*" },
          { account: "60970:Travel & Education", category: "*" },
        ],
      },
      {
        name: "Interest/Amortization/Fees",
        items: [
          {
            account: "80000:Interest/Bond Amortz/Trustee Fees",
            category: "*",
          },
        ],
      },
    ],
  },
  {
    name: "Total Operating Expenses",
    total: ["Salaries & Benefits/", "Other Direct Expenses/"],
    highlight: true,
  },
  {
    name: "Operating Margin",
    total: [
      "Patient Revenues/",
      "Other Revenue/",
      "-Deductions/",
      "-Salaries & Benefits/",
      "-Other Direct Expenses/",
    ],
    bold: true,
    highlight: true,
  },
  {
    name: "Non-Operating Gains",
    items: [
      { account: "46000:Non-Operating Revenue", negative: true, category: "*" },
      {
        account: "46010:Foundation Donations (NOP)",
        negative: true,
        category: "*",
      },
      {
        account: "46020:Special Levy UTGO Tax Revenue (NOP)",
        negative: true,
        category: "*",
      },
      {
        account: "46021:Regular Levy LTGO Tax Revenue (NOP)",
        negative: true,
        category: "*",
      },
    ],
  },
  {
    name: "Non-Operating Expenses",
    items: [{ account: "69900:Non-Operating Expenses", category: "*" }],
  },
  {
    name: "Investments (Non-Operating)",
    items: [
      { account: "90000:Gain/Loss Investments (NOP)", category: "*" },
      {
        account: "90010:Rental Income - Medical Office Building - (NOP)",
        category: "*",
      },
    ],
  },
  {
    name: "Net Non-Operating Gain (Loss)",
    total: [
      "Non-Operating Gains/",
      "-Non-Operating Expenses/",
      "Investments (Non-Operating)/",
    ],
    highlight: true,
  },
  {
    name: "Net Income",
    total: [
      "Patient Revenues/",
      "-Deductions/",
      "-Salaries & Benefits/",
      "-Other Direct Expenses/",
      "Non-Operating Gains/",
      "-Non-Operating Expenses/",
      "Investments (Non-Operating)/",
    ],
    bold: true,
    highlight: true,
  },
];
