// Department configuration similar to the Python configs
export const DEPARTMENTS = {
  msu_icu: {
    name: "MSU / ICU",
    sub_depts: [
      { name: "MSU", wd_ids: ["CC_60700"] },
      { name: "ICU", wd_ids: ["CC_60100"] },
    ],
  },
  hospitalist: { name: "Hospitalist", wd_ids: ["CC_60150"] },
  bp: { name: "Birthplace", wd_ids: ["CC_60790"] },
  surg: { name: "Surgical Services", wd_ids: ["CC_70200"] },
  sds: { name: "Same Day Services", wd_ids: ["CC_70260"] },
  pain: { name: "Pain Clinic", wd_ids: ["CC_70270"] },
  pacu: { name: "PACU", wd_ids: ["CC_70300"] },
  lab: { name: "Laboratory", wd_ids: ["CC_70700"] },
  imaging: {
    name: "Imaging",
    sub_depts: [
      { name: "MRI", wd_ids: ["CC_71200"] },
      { name: "CT/Imaging", wd_ids: ["CC_71300", "CC_71400"] },
      { name: "Ultrasound", wd_ids: ["CC_71430"] },
      { name: "Mammography", wd_ids: ["CC_71450"] },
      { name: "Nuclear Medicine", wd_ids: ["CC_71600"] },
    ],
  },
  pharmacy: { name: "Pharmacy", wd_ids: ["CC_71700"] },
  rt: { name: "Respiratory Care Services", wd_ids: ["CC_71800"] },
  cardio_pulm_rehab: {
    name: "Cardiopulmonary Rehab Services",
    wd_ids: ["CC_71850"],
  },
  summit: {
    name: "Summit",
    sub_depts: [
      { name: "Rehabilitation (PT/OT/ST)", wd_ids: ["CC_72000"] },
      { name: "Stadium Way", wd_ids: ["CC_72015"] },
      { name: "Massage Therapy", wd_ids: ["CC_72025"] },
      { name: "Athletic Training", wd_ids: ["CC_72035"] },
      { name: "Acupuncture", wd_ids: ["CC_72045"] },
      { name: "Genetic Counseling", wd_ids: ["CC_72055"] },
    ],
  },
  ed: {
    name: "Emergency",
    sub_depts: [
      { name: "Department Services", wd_ids: ["CC_72300"] },
      { name: "ED Physicians", wd_ids: ["CC_72390"] },
    ],
  },
  travel: { name: "Travel Clinic", wd_ids: ["CC_72301"] },
  palouse_med: { name: "Palouse Medical", wd_ids: ["CC_72710"] },
  podiatry: { name: "Podiatry Foot & Ankle Clinic", wd_ids: ["CC_72720"] },
  sports: { name: "Sports Medicine", wd_ids: ["CC_72730"] },
  peds: {
    name: "Palouse Pediatrics",
    sub_depts: [
      { name: "Palouse Peds WA", wd_ids: ["CC_72740"] },
      { name: "Palouse Peds ID", wd_ids: ["CC_72745"] },
    ],
  },
  urology: { name: "Palouse Urology", wd_ids: ["CC_72750"] },
  bh: {
    name: "Psychiatry & Behavioral Health",
    wd_ids: ["CC_72760"],
  },
  family_med: { name: "Pullman Family Medicine", wd_ids: ["CC_72770"] },
  health_center: { name: "Palouse Health Center", wd_ids: ["CC_72775"] },
  surgery: { name: "Pullman Surgical Associates", wd_ids: ["CC_72780"] },
  sleep: {
    name: "Sleep Medicine",
    sub_depts: [
      { name: "Sleep Medicine Clinic", wd_ids: ["CC_72785"] },
      { name: "Sleep Lab", wd_ids: ["CC_71810"] },
    ],
  },
  cards: { name: "Cardiology Heart Center", wd_ids: ["CC_72790"] },
  ortho: {
    name: "Inland Orthopedics",
    sub_depts: [
      { name: "Orthopedics WA", wd_ids: ["CC_72795"] },
      { name: "Orthopedics ID", wd_ids: ["CC_72800"] },
    ],
  },
  residency: { name: "Residency Clinic", wd_ids: ["CC_74910"] },
  food_services: { name: "Food Services", wd_ids: ["CC_83200"] },
  nutrition: { name: "Nutrition Therapy", wd_ids: ["CC_83210"] },
  clinics: {
    name: "All Outpatient Clinics",
    sub_depts: [
      { name: "Residency Clinic", wd_ids: ["CC_74910"] },
      {
        name: "Inland Orthopedics",
        wd_ids: [
          "CC_72800", // Inland Ortho ID
          "CC_72795", // Inland Ortho WA
        ],
      },

      { name: "Cardiology Heart Center", wd_ids: ["CC_72790"] },
      {
        name: "Palouse Pediatrics",
        wd_ids: [
          "CC_72745", // Palouse Peds ID
          "CC_72740", // Palouse Peds WA
        ],
      },
      { name: "Psychiatry & Behavioral Health", wd_ids: ["CC_72760"] },
      { name: "Sleep Medicine", wd_ids: ["CC_72785"] },
      { name: "Palouse Urology", wd_ids: ["CC_72750"] },
      { name: "Pullman Family Medicine", wd_ids: ["CC_72770"] },
      { name: "Palouse Health Center", wd_ids: ["CC_72775"] },
      { name: "Podiatry Foot & Ankle Clinic", wd_ids: ["CC_72720"] },
      { name: "Pullman Surgical Associates", wd_ids: ["CC_72780"] },
      { name: "Sports Medicine", wd_ids: ["CC_72730"] },
      { name: "Palouse Medical", wd_ids: ["CC_72710"] },
    ],
  },
};

export function getDepartmentConfig(deptId) {
  return DEPARTMENTS[deptId] || null;
}

export function getAllDepartments() {
  return Object.keys(DEPARTMENTS)
    .map((id) => ({
      id,
      ...DEPARTMENTS[id],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
