import type {
  AbsenceCase,
  CoverageCandidate,
  CoveragePolicy,
  School,
  StaffMember,
} from "@/domain/types";

export const riversideSchool: School = {
  id: "school-riverside",
  name: "Riverside Community School",
};

export const riversideCoveragePolicy: CoveragePolicy = {
  schoolId: riversideSchool.id,
  maxDailyCoveragePeriods: 5,
  preferSubjectQualifiedFor: ["Math", "Science"],
  preferSingleCandidate: true,
  requireCandidateAcceptance: true,
  protectedPlanningRequiresApproval: true,
  externalSubstituteRequiresApproval: true,
  combineGroupsRequiresApproval: true,
};

export const scenarioAAbsentTeacher: StaffMember = {
  id: "staff-sarah-miller",
  schoolId: riversideSchool.id,
  name: "Sarah Miller",
  subject: "Math",
};

export const scenarioAAbsence: AbsenceCase = {
  id: "case-scenario-a",
  schoolId: riversideSchool.id,
  absentStaffMemberId: scenarioAAbsentTeacher.id,
  subject: "Math",
  date: "2026-09-14",
  affectedPeriods: ["P1", "P2", "P4", "P6"],
  status: "open",
  createdAt: "2026-09-14T05:42:00.000Z",
  updatedAt: "2026-09-14T05:42:00.000Z",
};

export const scenarioACandidates: readonly CoverageCandidate[] = [
  {
    id: "candidate-alex-johnson",
    schoolId: riversideSchool.id,
    name: "Alex Johnson",
    qualifiedSubjects: ["Math"],
    availablePeriods: ["P1", "P2", "P4", "P6"],
    conflictingPeriods: [],
    protectedPlanningPeriods: [],
    dailyCoverageCount: 0,
    active: true,
  },
  {
    id: "candidate-maria-patel",
    schoolId: riversideSchool.id,
    name: "Maria Patel",
    qualifiedSubjects: ["Math"],
    availablePeriods: ["P2", "P4", "P6"],
    conflictingPeriods: [],
    protectedPlanningPeriods: [],
    dailyCoverageCount: 0,
    active: true,
  },
  {
    id: "candidate-david-kim",
    schoolId: riversideSchool.id,
    name: "David Kim",
    qualifiedSubjects: ["General"],
    availablePeriods: ["P1", "P4"],
    conflictingPeriods: [],
    protectedPlanningPeriods: [],
    dailyCoverageCount: 0,
    active: true,
  },
];

export const scenarioBAbsentTeacher: StaffMember = {
  id: "staff-daniel-reed",
  schoolId: riversideSchool.id,
  name: "Daniel Reed",
  subject: "Science",
};

export const scenarioBAbsence: AbsenceCase = {
  id: "case-scenario-b",
  schoolId: riversideSchool.id,
  absentStaffMemberId: scenarioBAbsentTeacher.id,
  subject: "Science",
  date: "2026-09-14",
  affectedPeriods: ["P2", "P3", "P5"],
  status: "open",
  createdAt: "2026-09-14T05:50:00.000Z",
  updatedAt: "2026-09-14T05:50:00.000Z",
};

export const scenarioBCandidates: readonly CoverageCandidate[] = [
  {
    id: "candidate-jordan-lee",
    schoolId: riversideSchool.id,
    name: "Jordan Lee",
    qualifiedSubjects: ["Science"],
    availablePeriods: ["P2", "P3"],
    conflictingPeriods: [],
    protectedPlanningPeriods: [],
    dailyCoverageCount: 0,
    active: true,
  },
  {
    id: "candidate-ms-taylor",
    schoolId: riversideSchool.id,
    name: "Ms. Taylor",
    qualifiedSubjects: ["Science"],
    availablePeriods: ["P5"],
    conflictingPeriods: [],
    protectedPlanningPeriods: ["P5"],
    dailyCoverageCount: 0,
    active: true,
  },
];

export const scenarioCAbsentTeacher: StaffMember = {
  id: "staff-olivia-chen",
  schoolId: riversideSchool.id,
  name: "Olivia Chen",
  subject: "English",
};

export const scenarioCAbsence: AbsenceCase = {
  id: "case-scenario-c",
  schoolId: riversideSchool.id,
  absentStaffMemberId: scenarioCAbsentTeacher.id,
  subject: "English",
  date: "2026-09-14",
  affectedPeriods: ["P1", "P3", "P6"],
  status: "open",
  createdAt: "2026-09-14T06:10:00.000Z",
  updatedAt: "2026-09-14T06:10:00.000Z",
};

export const scenarioCCandidates: readonly CoverageCandidate[] = [
  {
    id: "candidate-emma-brooks",
    schoolId: riversideSchool.id,
    name: "Emma Brooks",
    qualifiedSubjects: ["English"],
    availablePeriods: ["P1", "P3", "P6"],
    conflictingPeriods: [],
    protectedPlanningPeriods: [],
    dailyCoverageCount: 0,
    active: true,
  },
  {
    id: "candidate-noah-carter",
    schoolId: riversideSchool.id,
    name: "Noah Carter",
    qualifiedSubjects: ["English"],
    availablePeriods: ["P1", "P3", "P6"],
    conflictingPeriods: [],
    protectedPlanningPeriods: [],
    dailyCoverageCount: 1,
    active: true,
  },
];