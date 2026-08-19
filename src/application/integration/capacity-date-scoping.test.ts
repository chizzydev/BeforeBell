import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCoverageOffer,
} from "@/application/actions/create-coverage-offer";

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

const candidate:
  CoverageCandidate = {
    id:
      "candidate-date-capacity",

    schoolId:
      "school-riverside",

    name:
      "Date Capacity Candidate",

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

    dailyCoverageCount:
      4,

    active:
      true,
  };

function createCase(
  id: string,
  date: string,
  period:
    "P1" | "P2",
): AbsenceCase {
  return {
    id,

    schoolId:
      "school-riverside",

    absentStaffMemberId:
      `staff-${id}`,

    subject:
      "Science",

    date,

    affectedPeriods: [
      period,
    ],

    status:
      "open",

    createdAt:
      `${date}T05:50:00.000Z`,

    updatedAt:
      `${date}T05:50:00.000Z`,
  };
}

describe(
  "candidate capacity date scoping",
  () => {
    it(
      "rejects a new offer when baseline plus same-day BeforeBell load reaches the maximum",
      async () => {
        const currentCase =
          createCase(
            "case-current-same-day",
            "2026-09-15",
            "P2",
          );

        const priorCase =
          createCase(
            "case-prior-same-day",
            "2026-09-15",
            "P1",
          );

        const priorAssignment:
          CoverageAssignment = {
            id:
              "assignment-prior-same-day",

            caseId:
              priorCase.id,

            candidateId:
              candidate.id,

            periodIds: [
              "P1",
            ],

            source:
              "accepted_offer",

            offerId:
              "offer-prior-same-day",

            createdAt:
              "2026-09-15T05:40:00.000Z",
          };

        const store =
          new InMemoryBeforeBellStore({
            policies: [
              riversideCoveragePolicy,
            ],

            cases: [
              currentCase,
              priorCase,
            ],

            candidates: [
              candidate,
            ],

            assignments: [
              priorAssignment,
            ],
          });

        const result =
          await createCoverageOffer(
            store,
            {
              offerId:
                "offer-current-same-day",

              caseId:
                currentCase.id,

              candidateId:
                candidate.id,

              periodIds: [
                "P2",
              ],

              now:
                new Date(
                  "2026-09-15T06:00:00.000Z",
                ),

              expiresAt:
                new Date(
                  "2026-09-15T06:30:00.000Z",
                ),

              activityEventId:
                "activity-current-same-day",

              correlationId:
                "correlation-current-same-day",
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
      },
    );

    it(
      "does not count a previous day's assignment against today's offer capacity",
      async () => {
        const currentCase =
          createCase(
            "case-current-next-day",
            "2026-09-15",
            "P2",
          );

        const priorCase =
          createCase(
            "case-prior-previous-day",
            "2026-09-14",
            "P1",
          );

        const priorAssignment:
          CoverageAssignment = {
            id:
              "assignment-prior-previous-day",

            caseId:
              priorCase.id,

            candidateId:
              candidate.id,

            periodIds: [
              "P1",
            ],

            source:
              "accepted_offer",

            offerId:
              "offer-prior-previous-day",

            createdAt:
              "2026-09-14T06:00:00.000Z",
          };

        const store =
          new InMemoryBeforeBellStore({
            policies: [
              riversideCoveragePolicy,
            ],

            cases: [
              currentCase,
              priorCase,
            ],

            candidates: [
              candidate,
            ],

            assignments: [
              priorAssignment,
            ],
          });

        const result =
          await createCoverageOffer(
            store,
            {
              offerId:
                "offer-current-next-day",

              caseId:
                currentCase.id,

              candidateId:
                candidate.id,

              periodIds: [
                "P2",
              ],

              now:
                new Date(
                  "2026-09-15T06:00:00.000Z",
                ),

              expiresAt:
                new Date(
                  "2026-09-15T06:30:00.000Z",
                ),

              activityEventId:
                "activity-current-next-day",

              correlationId:
                "correlation-current-next-day",
            },
          );

        expect(
          result.success,
        ).toBe(true);

        expect(
          result.code,
        ).toBe(
          "offer_created",
        );
      },
    );

    it(
      "does not count a previous day's assignment during final accepted-offer revalidation",
      async () => {
        const currentCase =
          createCase(
            "case-current-assignment",
            "2026-09-15",
            "P2",
          );

        const priorCase =
          createCase(
            "case-prior-assignment",
            "2026-09-14",
            "P1",
          );

        const priorAssignment:
          CoverageAssignment = {
            id:
              "assignment-prior-date",

            caseId:
              priorCase.id,

            candidateId:
              candidate.id,

            periodIds: [
              "P1",
            ],

            source:
              "accepted_offer",

            offerId:
              "offer-prior-date",

            createdAt:
              "2026-09-14T06:00:00.000Z",
          };

        const acceptedOffer:
          CoverageOffer = {
            id:
              "offer-current-accepted",

            caseId:
              currentCase.id,

            candidateId:
              candidate.id,

            periodIds: [
              "P2",
            ],

            status:
              "accepted",

            createdAt:
              "2026-09-15T06:00:00.000Z",

            expiresAt:
              "2026-09-15T06:30:00.000Z",

            respondedAt:
              "2026-09-15T06:02:00.000Z",
          };

        const store =
          new InMemoryBeforeBellStore({
            policies: [
              riversideCoveragePolicy,
            ],

            cases: [
              currentCase,
              priorCase,
            ],

            candidates: [
              candidate,
            ],

            offers: [
              acceptedOffer,
            ],

            assignments: [
              priorAssignment,
            ],
          });

        const result =
          await assignAcceptedCoverage(
            store,
            {
              assignmentId:
                "assignment-current-date",

              offerId:
                acceptedOffer.id,

              now:
                new Date(
                  "2026-09-15T06:05:00.000Z",
                ),

              activityEventId:
                "activity-current-assignment",

              correlationId:
                "correlation-current-assignment",
            },
          );

        expect(
          result.success,
        ).toBe(true);

        expect(
          result.code,
        ).toBe(
          "assignment_created",
        );
      },
    );
  },
);