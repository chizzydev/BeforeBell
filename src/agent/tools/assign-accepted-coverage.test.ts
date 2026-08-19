import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createAssignAcceptedCoverageTool,
} from "@/agent/tools/assign-accepted-coverage";

import {
  InMemoryBeforeBellStore,
} from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageOffer,
} from "@/domain/types";

const offeringCase: AbsenceCase = {
  ...scenarioAAbsence,
  status: "offering",
  updatedAt:
    "2026-09-14T06:00:00.000Z",
};

function acceptedOffer(): CoverageOffer {
  return {
    id:
      "offer-scenario-a-accepted",

    caseId:
      scenarioAAbsence.id,

    candidateId:
      "candidate-alex-johnson",

    periodIds: [
      "P1",
      "P2",
      "P4",
      "P6",
    ],

    status:
      "accepted",

    createdAt:
      "2026-09-14T05:55:00.000Z",

    expiresAt:
      "2026-09-14T06:20:00.000Z",

    respondedAt:
      "2026-09-14T06:00:00.000Z",
  };
}

function createStore(
  offer: CoverageOffer = acceptedOffer(),
) {
  return new InMemoryBeforeBellStore({
    policies: [
      riversideCoveragePolicy,
    ],

    cases: [
      offeringCase,
    ],

    candidates:
      scenarioACandidates,

    offers: [
      offer,
    ],
  });
}

describe("createAssignAcceptedCoverageTool", () => {
  it("assigns an authoritative accepted offer and resolves Scenario A", async () => {
    const store =
      createStore();

    const tool =
      createAssignAcceptedCoverageTool(
        store,
        {
          now: () =>
            new Date(
              "2026-09-14T06:05:00.000Z",
            ),
        },
      );

    const result =
      await tool.invoke({
        caseId:
          scenarioAAbsence.id,

        offerId:
          "offer-scenario-a-accepted",
      });

    expect(result.success).toBe(
      true,
    );

    expect(result.code).toBe(
      "assignment_created",
    );

    expect(
      result.data?.caseStatus,
    ).toBe("resolved");

    expect(
      result.data?.caseStatusChanged,
    ).toBe(true);

    const assignments =
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      );

    expect(assignments).toHaveLength(
      1,
    );

    expect(
      assignments[0],
    ).toMatchObject({
      caseId:
        scenarioAAbsence.id,

      candidateId:
        "candidate-alex-johnson",

      periodIds: [
        "P1",
        "P2",
        "P4",
        "P6",
      ],

      source:
        "accepted_offer",

      offerId:
        "offer-scenario-a-accepted",
    });

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("resolved");

    expect(
      (
        await store.listActivityByCase(
          scenarioAAbsence.id,
        )
      ).map(
        (event) =>
          event.action,
      ),
    ).toEqual([
      "coverage_assignment_created",
      "coverage_case_status_updated",
    ]);
  });

  it("refuses to assign a pending offer", async () => {
    const store =
      createStore({
        ...acceptedOffer(),
        status: "pending",
        respondedAt: undefined,
      });

    const tool =
      createAssignAcceptedCoverageTool(
        store,
        {
          now: () =>
            new Date(
              "2026-09-14T06:05:00.000Z",
            ),
        },
      );

    const result =
      await tool.invoke({
        caseId:
          scenarioAAbsence.id,

        offerId:
          "offer-scenario-a-accepted",
      });

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "offer_not_accepted",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("offering");
  });

  it("revalidates candidate availability after acceptance", async () => {
    const store =
      createStore();

    const alex =
      await store.getCandidate(
        "candidate-alex-johnson",
      );

    if (!alex) {
      throw new Error(
        "Expected Alex Johnson fixture",
      );
    }

    await store.putCandidate({
      ...alex,

      availablePeriods: [
        "P1",
        "P2",
        "P4",
      ],
    });

    const tool =
      createAssignAcceptedCoverageTool(
        store,
        {
          now: () =>
            new Date(
              "2026-09-14T06:05:00.000Z",
            ),
        },
      );

    const result =
      await tool.invoke({
        caseId:
          scenarioAAbsence.id,

        offerId:
          "offer-scenario-a-accepted",
      });

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "candidate_no_longer_eligible",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("offering");
  });

  it("rejects using an offer with the wrong case ID", async () => {
    const store =
      createStore();

    const tool =
      createAssignAcceptedCoverageTool(
        store,
        {
          now: () =>
            new Date(
              "2026-09-14T06:05:00.000Z",
            ),
        },
      );

    const result =
      await tool.invoke({
        caseId:
          "case-different",

        offerId:
          "offer-scenario-a-accepted",
      });

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "offer_case_mismatch",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });

  it("replays the same assignment idempotently without duplicating assignment or activity", async () => {
    const store =
      createStore();

    let currentTime =
      new Date(
        "2026-09-14T06:05:00.000Z",
      );

    const tool =
      createAssignAcceptedCoverageTool(
        store,
        {
          now: () =>
            currentTime,
        },
      );

    const input = {
      caseId:
        scenarioAAbsence.id,

      offerId:
        "offer-scenario-a-accepted",
    };

    const first =
      await tool.invoke(input);

    currentTime =
      new Date(
        "2026-09-14T06:10:00.000Z",
      );

    const replay =
      await tool.invoke(input);

    expect(first.success).toBe(
      true,
    );

    expect(first.code).toBe(
      "assignment_created",
    );

    expect(replay.success).toBe(
      true,
    );

    expect(replay.code).toBe(
      "assignment_already_created",
    );

    expect(
      replay.data?.idempotentReplay,
    ).toBe(true);

    expect(
      replay.data?.caseStatus,
    ).toBe("resolved");

    expect(
      replay.data?.caseStatusChanged,
    ).toBe(false);

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(2);
  });
});