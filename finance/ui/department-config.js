// Department configuration similar to the Python configs
export const DEPARTMENTS = {
  'medsurg': { name: 'Medical Surgical Unit', wd_ids: ['CC_60700'] },
  'icu': { name: 'ICU', wd_ids: ['CC_60100'] },
  'ed_dept': { name: 'Emergency Department', wd_ids: ['CC_72300'] },
  'birthplace': { name: 'Birthplace', wd_ids: ['CC_60790'] },
  'pacu': { name: 'Post Anesthesia Care Unit', wd_ids: ['CC_70300'] },
  'surgical_svc': { name: 'Surgical Services', wd_ids: ['CC_70200'] },
  'anesthesiology': { name: 'Anesthesiology', wd_ids: ['CC_70400'] },
  'pharmacy': { name: 'Pharmacy', wd_ids: ['CC_71700'] },
  'lab': { name: 'Laboratory', wd_ids: ['CC_70700'] },
  'imaging': { 
    name: 'Imaging', 
    wd_ids: ['CC_71300', 'CC_71400', 'CC_71200', 'CC_71430', 'CC_71600', 'CC_71450'] 
  },
  'respiratory': { name: 'Respiratory Care Services', wd_ids: ['CC_71800'] },
  'family_med': { name: 'Pullman Family Medicine', wd_ids: ['CC_72770'] },
  'pediatrics': { name: 'Palouse Pediatrics', wd_ids: ['CC_72745', 'CC_72740'] },
  'heart_center': { name: 'Palouse Heart Center', wd_ids: ['CC_72790'] },
  'ortho': { name: 'Inland Orthopedics', wd_ids: ['CC_72800', 'CC_72795'] },
  'urology': { name: 'Palouse Urology', wd_ids: ['CC_72750'] },
  'sleep': { name: 'Palouse Sleep Medicine and Pulmonology', wd_ids: ['CC_72785'] },
  'surgery': { name: 'Pullman Surgical Associates', wd_ids: ['CC_72780'] },
  'foot_ankle': { name: 'Pullman Foot and Ankle Clinic', wd_ids: ['CC_72720'] },
  'hospitalist': { name: 'Hospitalist', wd_ids: ['CC_60150'] },
  'finance': { name: 'Finance', wd_ids: ['CC_85910'] },
  'hr': { name: 'Human Resources', wd_ids: ['CC_86500'] },
  'admin': { name: 'Administration', wd_ids: ['CC_86000'] },
  'it': { name: 'Information Technology', wd_ids: ['CC_84800'] },
  'environmental_svc': { name: 'Environmental Services', wd_ids: ['CC_84600'] },
  'maintenance': { name: 'Maintenance', wd_ids: ['CC_84310'] },
  'clinics': { 
    name: 'All Outpatient Clinics', 
    wd_ids: ['CC_74910', 'CC_72800', 'CC_72795', 'CC_72775', 'CC_72790', 'CC_72745', 'CC_72740', 'CC_72760', 'CC_72785', 'CC_72750', 'CC_72770', 'CC_72720', 'CC_72780'] 
  }
};

export function getDepartmentConfig(deptId) {
  return DEPARTMENTS[deptId] || null;
}

export function getAllDepartments() {
  return Object.keys(DEPARTMENTS).map(id => ({
    id,
    ...DEPARTMENTS[id]
  })).sort((a, b) => a.name.localeCompare(b.name));
}