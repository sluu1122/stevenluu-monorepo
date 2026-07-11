export interface CptCode {
  code: string;
  description: string;
}

export const CPT_CODES: CptCode[] = [
  // Emergency Department E&M
  { code: '99281', description: 'ED visit — self-limited or minor problem' },
  { code: '99282', description: 'ED visit — low complexity decision making' },
  { code: '99283', description: 'ED visit — moderate complexity decision making' },
  { code: '99284', description: 'ED visit — moderately high complexity decision making' },
  { code: '99285', description: 'ED visit — high complexity decision making' },

  // Critical Care
  { code: '99291', description: 'Critical care, first 30–74 minutes' },
  { code: '99292', description: 'Critical care, each additional 30 minutes' },

  // Inpatient Initial Care
  { code: '99221', description: 'Initial hospital inpatient care, low complexity' },
  { code: '99222', description: 'Initial hospital inpatient care, moderate complexity' },
  { code: '99223', description: 'Initial hospital inpatient care, high complexity' },

  // Subsequent Hospital Care
  { code: '99231', description: 'Subsequent hospital care, low complexity' },
  { code: '99232', description: 'Subsequent hospital care, moderate complexity' },
  { code: '99233', description: 'Subsequent hospital care, high complexity' },

  // Hospital Discharge
  { code: '99238', description: 'Hospital discharge day management, ≤30 minutes' },
  { code: '99239', description: 'Hospital discharge day management, >30 minutes' },

  // Observation
  { code: '99234', description: 'Observation or inpatient care, initial, low complexity' },
  { code: '99235', description: 'Observation or inpatient care, initial, moderate complexity' },
  { code: '99236', description: 'Observation or inpatient care, initial, high complexity' },
  { code: '99217', description: 'Observation care discharge day management' },

  // Office / Outpatient E&M (new patient)
  { code: '99202', description: 'Office visit, new patient — straightforward decision making' },
  { code: '99203', description: 'Office visit, new patient — low complexity decision making' },
  { code: '99204', description: 'Office visit, new patient — moderate complexity decision making' },
  { code: '99205', description: 'Office visit, new patient — high complexity decision making' },

  // Office / Outpatient E&M (established patient)
  { code: '99211', description: 'Office visit, established patient — minimal presenting problems' },
  { code: '99212', description: 'Office visit, established patient — straightforward decision making' },
  { code: '99213', description: 'Office visit, established patient — low complexity decision making' },
  { code: '99214', description: 'Office visit, established patient — moderate complexity decision making' },
  { code: '99215', description: 'Office visit, established patient — high complexity decision making' },

  // Radiology — Chest
  { code: '71045', description: 'Chest X-ray, single view' },
  { code: '71046', description: 'Chest X-ray, 2 views' },
  { code: '71047', description: 'Chest X-ray, 3 views' },
  { code: '71048', description: 'Chest X-ray, 4 or more views' },

  // Radiology — CT
  { code: '74177', description: 'CT abdomen and pelvis with contrast' },
  { code: '74178', description: 'CT abdomen and pelvis without and with contrast' },
  { code: '74176', description: 'CT abdomen and pelvis without contrast' },
  { code: '70450', description: 'CT head/brain without contrast' },
  { code: '70460', description: 'CT head/brain with contrast' },
  { code: '71250', description: 'CT thorax without contrast' },
  { code: '71260', description: 'CT thorax with contrast' },

  // Radiology — MRI
  { code: '70553', description: 'MRI brain without and with contrast' },
  { code: '70552', description: 'MRI brain with contrast' },
  { code: '70551', description: 'MRI brain without contrast' },
  { code: '72148', description: 'MRI lumbar spine without contrast' },
  { code: '72149', description: 'MRI lumbar spine with contrast' },
  { code: '73721', description: 'MRI joint of lower extremity without contrast' },
  { code: '73223', description: 'MRI joint of upper extremity without contrast' },

  // Radiology — Ultrasound
  { code: '76700', description: 'Ultrasound, abdominal, complete' },
  { code: '76705', description: 'Ultrasound, abdominal, limited' },
  { code: '93306', description: 'Echocardiography, complete transthoracic with spectral Doppler' },

  // IV / Infusion
  { code: '96365', description: 'IV infusion, therapy/prophylaxis, initial, up to 1 hour' },
  { code: '96366', description: 'IV infusion, each additional hour' },
  { code: '96374', description: 'IV push, single or initial substance/drug' },
  { code: '96375', description: 'IV push, each additional sequential substance/drug' },
  { code: '96360', description: 'IV infusion, hydration, initial, 31 minutes to 1 hour' },
  { code: '96361', description: 'IV infusion, hydration, each additional hour' },

  // Blood / Transfusion
  { code: '36415', description: 'Collection of venous blood by venipuncture' },
  { code: '36430', description: 'Transfusion, blood or blood products' },

  // Cardiac
  { code: '93000', description: 'Electrocardiogram, routine 12-lead with interpretation' },
  { code: '93005', description: 'Electrocardiogram, routine 12-lead, tracing only' },

  // Respiratory
  { code: '94640', description: 'Pressurized or unpressurized inhalation treatment' },
  { code: '94760', description: 'Non-invasive ear or pulse oximetry for O2 saturation' },

  // Lab — Metabolic Panels
  { code: '80047', description: 'Basic metabolic panel (calcium, ionized)' },
  { code: '80048', description: 'Basic metabolic panel with calcium total' },
  { code: '80053', description: 'Comprehensive metabolic panel' },

  // Lab — CBC
  { code: '85025', description: 'Complete blood count with automated differential' },
  { code: '85027', description: 'Complete blood count, automated' },

  // Lab — Coagulation
  { code: '85730', description: 'Partial thromboplastin time (PTT)' },
  { code: '85610', description: 'Prothrombin time (PT/INR)' },

  // Lab — Cardiac Markers
  { code: '82553', description: 'Creatine kinase MB isoenzyme (CK-MB)' },
  { code: '83519', description: 'Troponin, quantitative' },

  // Lab — Urinalysis / Culture
  { code: '81001', description: 'Urinalysis with microscopy' },
  { code: '87086', description: 'Urine culture, quantitative colony count' },

  // Procedures — Wound
  { code: '10060', description: 'Incision and drainage of abscess, simple' },
  { code: '12001', description: 'Simple repair, superficial wounds, up to 2.5 cm' },
  { code: '12002', description: 'Simple repair, superficial wounds, 2.6–7.5 cm' },

  // Procedures — Orthopedic
  { code: '27447', description: 'Arthroplasty, knee, total replacement' },
  { code: '27130', description: 'Arthroplasty, hip, total replacement' },

  // Procedures — GI
  { code: '43239', description: 'Esophagogastroduodenoscopy (EGD) with biopsy' },
  { code: '45378', description: 'Colonoscopy, diagnostic' },
  { code: '47562', description: 'Laparoscopic cholecystectomy' },
];
