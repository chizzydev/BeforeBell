import {
  describe,
  expect,
  it,
} from "vitest";

import {
  assignAcceptedCoverage,
} from "@/application/actions/assign-accepted-coverage";

import {
  InMemoryBeforeBellStore,
} from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
} from "@/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
} from "@/domain/types";

const absenceCase:
  AbsenceCase = {
    id:
      "case-capacity-regression",

    schoolId:
      "school-riverside",

    absentStaffMemberId:
      "staff-capacity-regression",

    subject:
      "Science",

    date:
      "2026-09-14",

    affectedPeriods: [
      "P2",
    ],

    status:
      "open",

    createdAt:
      "2026-09-14T05:50:00.000Z",

    updatedAt:
      "2026-09-14T05:50:00.000Z",
  };

const candidate:
  CoverageCandidate = {
    id:
      "candidate-capacity-regression",

    schoolId:
      "school-riverside",

    name:
      "Capacity Regression Candidate",

    qualifiedSubjects: [
      "Science",
    ],

    availablePeriods: [
      "P1",
      "P2",
    ],

    conflictingPeriods:
      [],

    protectedPlanningPeriods:
      [],

    /**
     * Four periods already existed before the BeforeBell assignment
     * represented below.
     */
    dailyCoverageCount:
      4,

    active:
      true,
  };

const priorBeforeBellAssignment:
  CoverageAssignment = {
    id:
      "assignment-capacity-prior",

    caseId:
      "case-capacity-prior",

    candidateId:
      candidate.id,

    periodIds: [
      "P1",
    ],

    source:
      "accepted_offer",

    offerId:
      "offer-capacity-prior",

    createdAt:
      "2026-09-14T05:40:00.000Z",
  };

const acceptedOffer:
  CoverageOffer = {
    id:
      "offer-capacity-regression",

    caseId:
      absenceCase.id,

    candidateId:
      candidate.id,

    periodIds: [
      "P2",
    ],

    status:
      "accepted",

    createdAt:
      "2026-09-14T05:55:00.000Z",

    expiresAt:
      "2026-09-14T06:30:00.000Z",

    respondedAt:
      "2026-09-14T06:00:00.000Z",
  };

describe(
  "daily coverage capacity baseline",
  () => {
    it(
      "adds persisted BeforeBell assignments to the candidate's pre-existing daily load",
      async () => {
        const store =
          new InMemoryBeforeBellStore({
            policies: [
              riversideCoveragePolicy,
            ],

            cases: [
              absenceCase,
            ],

            candidates: [
              candidate,
            ],

            offers: [
              acceptedOffer,
            ],

            assignments: [
              priorBeforeBellAssignment,
            ],
          });

        /**
         * Candidate already has:
         *
         * baseline load = 4
         * persisted BeforeBell load = 1
         * effective load = 5
         *
         * Riverside policy maximum = 5.
         *
         * P2 must therefore be rejected even though P2 itself is available.
         */
        const result =
          await assignAcceptedCoverage(
            store,
            {
              assignmentId:
                "assignment-capacity-regression",

              offerId:
                acceptedOffer.id,

              now:
                new Date(
                  "2026-09-14T06:05:00.000Z",
                ),

              activityEventId:
                "activity-capacity-regression",

              correlationId:
                "correlation-capacity-regression",
            },
          );

        expect(
          result.success,
        ).toBe(false);

        expect(
          result.code,
        ).toBe(
          "candidate_no_longer_eligible",
        );

        /**
         * Only the original P1 assignment may remain.
         */
        expect(
          await store
            .listAssignmentsByCandidate(
              candidate.id,
            ),
        ).toEqual([
          priorBeforeBellAssignment,
        ]);

        expect(
          await store
            .listAssignmentsByCase(
              absenceCase.id,
            ),
        ).toEqual([]);

        expect(
          await store
            .listActivityByCase(
              absenceCase.id,
            ),
        ).toEqual([]);
      },
    );
  },
);