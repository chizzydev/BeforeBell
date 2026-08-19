export type BeforeBellDemoScenario =
  | "A"
  | "B"
  | "C";


export interface BeforeBellDemoCaseDefinition {
  scenario:
    BeforeBellDemoScenario;

  caseId:
    string;

  schoolId:
    string;

  schoolName:
    string;

  staffName:
    string;

  roleLabel:
    string;

  expectedPeriods:
    readonly string[];
}

export const BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE = {
  id:
    "external-substitute-morgan-ellis-demo",

  name:
    "Morgan Ellis",

  label:
    "External substitute",
} as const;


export const BEFOREBELL_DEMO_CLOCK = {
  externalSubstituteFulfilledAt:
    "2026-09-14T06:12:00.000Z",
} as const;

export const BEFOREBELL_DEMO_SCENARIO_B_BASELINE = {
  routineOfferId:
    "offer-beforebell-demo-b-jordan",

  routineAssignmentId:
    "assignment-beforebell-demo-b-jordan",

  absentStaffMemberId:
    "staff-daniel-reed-demo",

  updatedAt:
    "2026-09-14T06:04:00.000Z",
} as const;

export const BEFOREBELL_DEMO_CASES:
  readonly BeforeBellDemoCaseDefinition[] = [
    {
      scenario:
        "A",

      caseId:
        "case-beforebell-demo-a",

      schoolId:
        "school-riverside-demo-a",

      schoolName:
        "Riverside Community School",

      staffName:
        "Sarah Miller",

      roleLabel:
        "Grade 8 Math",

      expectedPeriods: [
        "P1",
        "P2",
        "P4",
        "P6",
      ],
    },

    {
      scenario:
        "B",

      caseId:
        "case-beforebell-demo-b",

      schoolId:
        "school-riverside-demo-b",

      schoolName:
        "Riverside Community School",

      staffName:
        "Daniel Reed",

      roleLabel:
        "Grade 7 Science",

      expectedPeriods: [
        "P2",
        "P3",
        "P5",
      ],
    },

    {
      scenario:
        "C",

      caseId:
        "case-beforebell-demo-c",

      schoolId:
        "school-riverside-demo-c",

      schoolName:
        "Riverside Community School",

      staffName:
        "Olivia Chen",

      roleLabel:
        "English",

      expectedPeriods: [
        "P1",
        "P3",
        "P6",
      ],
    },
  ];


export function getBeforeBellDemoCase(
  caseId:
    string,
): BeforeBellDemoCaseDefinition | undefined {
  return BEFOREBELL_DEMO_CASES.find(
    (
      demoCase,
    ) =>
      demoCase.caseId ===
      caseId,
  );
}